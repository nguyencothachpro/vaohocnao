const axios=require('axios');

function extractDriveId(url){
  const m=String(url||'').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([^/?&#]+)/i);
  return m?.[1]||null;
}

function candidates(url){
  const id=extractDriveId(url), out=[];
  if(id){
    out.push(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`);
    out.push(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`);
  }
  out.push(url);
  return out;
}

exports.pdf=async(req,res)=>{
  const source=String(req.query.source||'').trim();
  if(!source||!/^https:\/\/(?:drive\.google\.com|drive\.usercontent\.google\.com)\//i.test(source))return res.status(400).send('Nguồn PDF không hợp lệ.');
  let last=null;
  for(const url of candidates(source)){
    try{
      const r=await axios.get(url,{responseType:'arraybuffer',maxRedirects:8,timeout:30000,headers:{'User-Agent':'Mozilla/5.0','Accept':'application/pdf,application/octet-stream,*/*'}});
      const data=Buffer.from(r.data),type=String(r.headers['content-type']||'').toLowerCase();
      if(data.subarray(0,4).toString('ascii')==='%PDF'||type.includes('application/pdf')){
        res.setHeader('Content-Type','application/pdf');
        res.setHeader('Content-Length',String(data.length));
        res.setHeader('Cache-Control','private,max-age=300');
        res.setHeader('Content-Disposition','inline; filename="tai-lieu.pdf"');
        return res.status(200).send(data);
      }
      last=new Error('Nguồn Drive không trả về PDF.');
    }catch(e){last=e;}
  }
  console.error('Loi proxy PDF Drive:',last?.message||last);
  return res.status(502).send('Không tải được PDF từ Google Drive. Hãy kiểm tra file đã bật quyền "Bất kỳ ai có liên kết" chưa.');
};
