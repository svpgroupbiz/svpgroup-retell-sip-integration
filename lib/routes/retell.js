const useDialSipEndpointMethod = Number(process.env.USE_DIAL_SIP_ENDPOINT_METHOD) || 0;
const assert = require('assert');
const {registerCall} = require('../../lib/utils');

assert.ok(useDialSipEndpointMethod === 1 || process.env.RETELL_TRUNK_NAME,
  // eslint-disable-next-line max-len
  'RETELL_TRUNK_NAME env required when using elastic sip trunking method; it must contain the name of the jambonz BYOC trunk that connects to retell');

const service = ({logger, makeService}) => {
  const svc = makeService({path: '/retell'});

  svc.on('session:new', async(session) => {
    session.locals = {logger: logger.child({call_sid: session.call_sid})};
    const {from, to, direction, call_sid} = session;
    logger.info({session}, `new incoming call: ${session.call_sid}`);

    let outboundFromRetell = false;
    if (session.direction === 'inbound' &&
      process.env.PSTN_TRUNK_NAME && process.env.RETELL_SIP_CLIENT_USERNAME &&
      session.sip.headers['X-Authenticated-User']) {

      /* check if the call is coming from Retell; i.e. using the sip credential we provisioned there */
      const username = session.sip.headers['X-Authenticated-User'].split('@')[0];
      if (username === process.env.RETELL_SIP_CLIENT_USERNAME) {
        logger.info(`call ${session.call_sid} is coming from Retell`);
        outboundFromRetell = true;
      }
    }
    session
      .on('/refer', onRefer.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));

    try {
      let target;
      if (outboundFromRetell) {
        /* call is coming from Retell, so we will forward it to the original dialed number */
        target = [
          {
            type: 'phone',
            number: to,
            trunk: process.env.PSTN_TRUNK_NAME
          }
        ];
      }
      else if (useDialSipEndpointMethod) {
        /* https://docs.retellai.com/make-calls/custom-telephony#method-2-dial-to-sip-endpoint */
        const retell_call_id = await registerCall(logger, {
          agent_id: process.env.RETELL_AGENT_ID,
          from,
          to,
          direction,
          call_sid,
          retell_llm_dynamic_variables: {
            /* https://docs.retellai.com/retell-llm/dynamic-variables#phone-calls-with-your-own-numbers-custom-twilio */
            user_name: 'John Doe',
            user_email: 'john@example.com'
          }
        });
        logger.info({retell_call_id}, 'Call registered');
        target = [
          {
            type: 'sip',
            sipUri: `sip:${retell_call_id}@5t4n6j0wnrl.sip.livekit.cloud`
          }
        ];
      }
      else {
        /* https://docs.retellai.com/make-calls/custom-telephony#method-1-elastic-sip-trunking-recommended */

        /**
         * Note: below we are forwarding the incoming call to Retell using the same dialed number.
         * This presumes you have added this number to your Retell account.
         * If you added a different number, you can change the `to` variable.
         */
        target = [
          {
            type: 'phone',
            number: to,
            trunk: process.env.RETELL_TRUNK_NAME
          }
        ];
      }

      session
        .dial({
          callerId: callerId: outboundFromRetell ? '431103' : from,
          answerOnBridge: true,
          referHook: '/refer',
          target
        })
        .hangup()
        .send();
    } catch (err) {
      session.locals.logger.info({err}, `Error to responding to incoming call: ${session.call_sid}`);
      session.close();
    }
  });
};

const onRefer = (session, evt) => {
  const {logger} = session.locals;
  const {refer_details} = evt;
  logger.info({refer_details}, `session ${session.call_sid} received refer`);

  session
    .sip_refer({
      referTo: refer_details.refer_to_user,
      referredBy: evt.to
    })
    .reply();
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  logger.info({session, code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

module.exports = service;
