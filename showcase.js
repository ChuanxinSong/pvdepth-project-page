(() => {
  'use strict';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wall=document.querySelector('#panocarla-wall');
  const wallToggle=document.querySelector('#wall-toggle');
  const dialog=document.querySelector('#video-dialog');
  const viewer=dialog.querySelector('video');
  const title=dialog.querySelector('h3');
  const caption=dialog.querySelector('.video-dialog-caption');
  const status=dialog.querySelector('[role=status]');
  const motivation=document.querySelector('#motivation-video');
  let motivationVisible=false;
  let motivationPaused=reducedMotion;
  let automaticMotivationPause=false;
  const pauseMotivation=()=> {
    if(!motivation.paused){automaticMotivationPause=true;motivation.pause();}
  };
  motivation.addEventListener('play',()=>{motivationPaused=false;});
  motivation.addEventListener('pause',()=>{
    if(automaticMotivationPause)automaticMotivationPause=false;
    else motivationPaused=true;
  });
  new IntersectionObserver(entries=>{
    motivationVisible=entries[0].isIntersecting;
    if(motivationVisible&&!motivationPaused&&!document.hidden&&!dialog.open)motivation.play().catch(()=>{});
    else if(!motivationVisible)pauseMotivation();
  },{threshold:.25}).observe(motivation);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)pauseMotivation();
    else if(motivationVisible&&!motivationPaused&&!dialog.open)motivation.play().catch(()=>{});
  });
  dialog.addEventListener('close',()=>{
    if(motivationVisible&&!motivationPaused&&!document.hidden)motivation.play().catch(()=>{});
  });
  let wallVisible=false;
  let manualPause=reducedMotion;
  const syncToggle=()=> {
    wallToggle.textContent=wall.paused?'Play all clips':'Pause all clips';
    wallToggle.setAttribute('aria-label',wall.paused?'Play the PanoCARLA video wall':'Pause the PanoCARLA video wall');
  };
  wall.addEventListener('play',syncToggle);
  wall.addEventListener('pause',syncToggle);
  wall.addEventListener('error',()=> {
    document.querySelector('#wall-status').textContent='Video unavailable. You can explore the dataset using the links below.';
  });
  wallToggle.addEventListener('click',()=> {
    if(wall.paused){manualPause=false;wall.play().catch(()=>{});}
    else{manualPause=true;wall.pause();}
  });
  new IntersectionObserver(entries=> {
    wallVisible=entries[0].isIntersecting;
    if(wallVisible&&!manualPause&&!document.hidden&&!dialog.open)wall.play().catch(()=>{});
    else if(!wallVisible)wall.pause();
  },{threshold:.12}).observe(wall);
  document.addEventListener('visibilitychange',()=> {
    if(document.hidden){wall.pause();viewer.pause();}
    else if(wallVisible&&!manualPause&&!dialog.open)wall.play().catch(()=>{});
  });
  document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',()=> {
    wall.pause();
    pauseMotivation();
    document.querySelector('#rgb-video').pause();
    document.querySelector('#depth-video').pause();
    document.querySelector('#comparison-video').pause();
    status.textContent='';
    title.textContent=button.dataset.title;
    caption.textContent=button.dataset.caption;
    viewer.poster=button.dataset.poster;
    viewer.src=button.dataset.video;
    viewer.load();dialog.showModal();
    viewer.play().catch(()=>{});
  }));
  viewer.addEventListener('error',()=> {status.textContent='This video could not load. Please try another scene.';});
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=> {if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=> {
    viewer.pause();viewer.removeAttribute('src');viewer.load();
    if(wallVisible&&!manualPause&&!document.hidden)wall.play().catch(()=>{});
  });
})();
