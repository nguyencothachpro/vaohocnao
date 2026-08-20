(() => {
  let uploadModule;
  async function getUploader() {
    if (!uploadModule) uploadModule = import('https://esm.sh/@vercel/blob@2.6.1/client?bundle');
    return (await uploadModule).upload;
  }
  function hidden(form, name, value) {
    let el=form.querySelector(`input[data-vercel-upload="${CSS.escape(name)}"]`);
    if(!el){el=document.createElement('input');el.type='hidden';el.dataset.vercelUpload=name;el.name='vercel_blob_url_'+name;form.appendChild(el)}
    el.value=value;
  }
  function status(text){
    let box=document.getElementById('vercelUploadStatus');
    if(!box){box=document.createElement('div');box.id='vercelUploadStatus';box.style='position:fixed;right:18px;bottom:18px;z-index:99999;background:#111827;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 12px 35px rgba(0,0,0,.25);font-size:13px';document.body.appendChild(box)}
    box.textContent=text;box.style.display='block';return box;
  }
  document.querySelectorAll('form').forEach(form=>{
    const files=[...form.querySelectorAll('input[type="file"]')];
    if(!files.length||form.dataset.vercelUploadBound==='1')return;
    form.dataset.vercelUploadBound='1';
    form.addEventListener('submit',async e=>{
      if(form.dataset.vercelUploading==='1'||form.dataset.vercelUploaded==='1')return;
      const selected=files.filter(i=>i.files&&i.files[0]);
      if(!selected.length)return;
      e.preventDefault();form.dataset.vercelUploading='1';
      try{
        const upload=await getUploader();
        for(let i=0;i<selected.length;i++){
          const input=selected[i],file=input.files[0];
          status(`Đang tải ${i+1}/${selected.length}: ${file.name}`);
          const result=await upload(file.name,file,{access:'public',handleUploadUrl:'/api/blob-upload',clientPayload:JSON.stringify({field:input.name||'file',originalName:file.name})});
          hidden(form,input.name||'file',result.url);
          let n=form.querySelector(`input[name="vercel_blob_name_${CSS.escape(input.name||'file')}"]`);
          if(!n){n=document.createElement('input');n.type='hidden';n.name='vercel_blob_name_'+(input.name||'file');form.appendChild(n)}
          n.value=file.name;
          input.removeAttribute('name');input.value='';
        }
        form.dataset.vercelUploaded='1';status('Tải file xong, đang lưu dữ liệu...');form.submit();
      }catch(err){
        console.error('Vercel Blob upload:',err);form.dataset.vercelUploading='0';status('Tải file thất bại: '+(err?.message||err));setTimeout(()=>document.getElementById('vercelUploadStatus')?.remove(),6000);
      }
    });
  });
})();
