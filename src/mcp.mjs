export const TOOLS = [
  {name:'belagent_capabilities', description:'Read-only information about BelAgent mode, chain, and local payment safety policies.', inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'belagent_request_payment', description:'Prepare a BDX TESTNET payment for explicit human and wallet authorisation. Does NOT execute a payment. No keys, signatures, or background transfers.', inputSchema:{type:'object',properties:{to:{type:'string',description:'Beldex testnet destination address'},amount_bdx:{type:'string',description:'Positive decimal BDX amount as a string, e.g. 0.25'},reason:{type:'string',description:'Plain language purpose shown to the human'},requester:{type:'string',description:'Originating agent or application name'}},required:['to','amount_bdx','reason'],additionalProperties:false}},
  {name:'belagent_payment_status',description:'Read the status of a request, without inferring on-chain confirmation from a browser callback.',inputSchema:{type:'object',properties:{request_id:{type:'string'}},required:['request_id'],additionalProperties:false}}
];

export function createMcpHandler(store, baseUrl) {
  return async function handle(message) {
    if (!message || typeof message!=='object' || typeof message.method!=='string') return null;
    const respond = result => message.id===undefined ? null : {jsonrpc:'2.0',id:message.id,result};
    const fail=(code,description)=>message.id===undefined ? null : {jsonrpc:'2.0',id:message.id,error:{code,message:description}};
    try {
      if (message.method==='initialize') return respond({protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'belagent-testnet-poc',version:'0.1.0'},instructions:'Human approval required. No autonomous payment or mainnet support.'});
      if (message.method==='notifications/initialized') return null;
      if(message.method==='ping') return respond({});
      if(message.method==='tools/list') return respond({tools:TOOLS});
      if(message.method==='tools/call') {
        const name=message.params?.name; const args=message.params?.arguments||{};
        if(typeof args!=='object'||Array.isArray(args)) return fail(-32602,'Invalid tool arguments');
        let obj;
        if(name==='belagent_capabilities') obj=store.info();
        else if(name==='belagent_request_payment') {
          const {request,capability}=store.create(args);
          obj={...request,approval_url:`${baseUrl}/review/${request.id}/${capability}`,
            next_step:'Human must visit approval URL; even live mode always requires a wallet prompt.',
            note:'No blockchain transaction was broadcast by this MCP tool.'};
        } else if(name==='belagent_payment_status') obj=store.get(args.request_id);
        else return respond({content:[{type:'text',text:'Unknown tool'}],isError:true});
        return respond({content:[{type:'text',text:JSON.stringify(obj,null,2)}]});
      }
      return fail(-32601,'Method not found');
    } catch(e) {
      return message.method==='tools/call'
        ? respond({content:[{type:'text',text:e.message}],isError:true})
        : fail(-32603,'Internal server error');
    }
  };
}
