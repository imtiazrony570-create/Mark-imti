module.exports = async function handler(req,res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const body=req.body||{};
  const {provider,apiKey,model,baseUrl,messages}=body;
  if(!provider||!apiKey||!Array.isArray(messages)||!messages.length) return res.status(400).json({error:"provider, apiKey and messages are required"});
  const p=String(provider).toUpperCase();
  const errMsg=(raw,status)=>{try{const d=JSON.parse(raw);return d?.error?.message||d?.message||("Provider error ("+status+")")}catch{return (raw||"Provider request failed").slice(0,500)}};
  try{
    let response;
    if(p==="ANTHROPIC"){
      const system=messages.find(m=>m.role==="system")?.content;
      const clean=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"")}));
      response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:model||"claude-3-5-haiku-latest",max_tokens:2048,system,messages:clean})});
      const raw=await response.text();if(!response.ok)return res.status(response.status).json({error:errMsg(raw,response.status)});
      const data=JSON.parse(raw);const content=(data.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("");
      return res.status(200).json({content,model:data.model||model,provider:p});
    }
    if(p==="GEMINI"){
      const chosen=model||"gemini-2.5-flash";
      response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(chosen)+":generateContent?key="+encodeURIComponent(apiKey),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content||"")}]}))})});
      const raw=await response.text();if(!response.ok)return res.status(response.status).json({error:errMsg(raw,response.status)});
      const data=JSON.parse(raw);const content=data?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"";
      return res.status(200).json({content,model:chosen,provider:p});
    }
    const bases={OPENAI:"https://api.openai.com/v1",OPENROUTER:"https://openrouter.ai/api/v1",DEEPSEEK:"https://api.deepseek.com/v1",MISTRAL:"https://api.mistral.ai/v1",XAI:"https://api.x.ai/v1",CUSTOM:baseUrl||""};
    const base=(baseUrl||bases[p]||"").replace(/\/+$/,"");
    if(!base)return res.status(400).json({error:"A base URL is required for this provider."});
    const chosen=model||({OPENAI:"gpt-4o-mini",OPENROUTER:"openai/gpt-4o-mini",DEEPSEEK:"deepseek-chat",MISTRAL:"mistral-small-latest",XAI:"grok-3-mini"}[p]||"gpt-4o-mini");
    const headers={"content-type":"application/json","authorization":"Bearer "+apiKey};
    if(p==="OPENROUTER"){headers["HTTP-Referer"]="https://mark-imti.vercel.app";headers["X-Title"]="Mark-Imti";}
    response=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify({model:chosen,messages:messages.map(m=>({role:m.role,content:String(m.content||"")})),temperature:.4})});
    const raw=await response.text();if(!response.ok)return res.status(response.status).json({error:errMsg(raw,response.status)});
    const data=JSON.parse(raw);const content=data?.choices?.[0]?.message?.content;
    if(typeof content!=="string")return res.status(502).json({error:"Provider returned no text."});
    return res.status(200).json({content,model:data?.model||chosen,provider:p});
  }catch(e){return res.status(502).json({error:String(e?.message||e)})}
}