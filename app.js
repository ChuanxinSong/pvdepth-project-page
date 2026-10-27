(() => {
  'use strict';
  const rgb = document.querySelector('#rgb-video');
  const depth = document.querySelector('#depth-video');
  const videos = [rgb, depth];
  const playButton = document.querySelector('#play-toggle');
  const progress = document.querySelector('#video-progress');
  const demo = document.querySelector('#hero-demo');
  const current = document.querySelector('#time-current');
  const total = document.querySelector('#time-total');
  const instruction = document.querySelector('#view-instruction');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = false;
  let sphere = false;
  let renderers = [];
  let lastSync = 0;
  let seekActive = false;
  let pendingPlay = 0;
  const camera = {yaw:0, pitch:0};
  const sceneButtons = [...document.querySelectorAll('[data-scene]')];
  let sceneLoad = 0;
  const formatTime = value => `${Math.floor((value || 0)/60)}:${String(Math.floor((value || 0)%60)).padStart(2,'0')}`;
  const demoVisible = () => {
    const bounds=demo.getBoundingClientRect();
    return bounds.top<innerHeight&&bounds.bottom>0;
  };
  const restoreInstruction = () => {
    instruction.textContent=sphere?'Drag either view to look around. Arrow keys also work.':'Panoramic input → temporally consistent relative depth.';
  };

  function updatePlayButton() {
    playButton.textContent = playing ? 'Ⅱ' : '▶';
    playButton.setAttribute('aria-label', playing ? 'Pause synchronized videos' : 'Play synchronized videos');
  }
  function pause() {
    pendingPlay++;
    playing = false;
    videos.forEach(video => video.pause());
    updatePlayButton();
  }
  async function play() {
    const attempt = ++pendingPlay;
    try {
      if (Math.abs(depth.currentTime-rgb.currentTime)>.06) depth.currentTime = rgb.currentTime;
      await Promise.all(videos.map(video=>video.play()));
      if (attempt !== pendingPlay) return;
      playing = true;
      updatePlayButton();
    } catch (_) {
      if (attempt === pendingPlay) pause();
    }
  }
  playButton.addEventListener('click',()=>playing ? pause() : play());
  sceneButtons.forEach(button=>button.addEventListener('click',async()=> {
    if(button.getAttribute('aria-pressed')==='true')return;
    pause();
    const generation=++sceneLoad;
    const intent=pendingPlay;
    camera.yaw=0;camera.pitch=0;
    current.textContent='0:00';total.textContent='0:00';progress.value=0;
    sceneButtons.forEach(item=> {
      const selected=item===button;
      item.classList.toggle('active',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
    document.querySelector('#scene-title').textContent=button.dataset.title;
    document.querySelector('#scene-caption').textContent=button.dataset.caption;
    const ready=videos.map((video,index)=>new Promise(resolve=> {
      video.addEventListener('loadeddata',resolve,{once:true});
      video.addEventListener('error',resolve,{once:true});
      video.src=index===0?button.dataset.rgb:button.dataset.depth;
      video.poster=index===0?button.dataset.rgbPoster:button.dataset.depthPoster;
      video.preload='auto';video.load();
    }));
    await Promise.all(ready);
    if(generation!==sceneLoad)return;
    if(videos.every(video=>!video.error))restoreInstruction();
    if(intent===pendingPlay&&!reducedMotion&&!document.hidden&&demoVisible())play();
  }));
  const updateDuration=()=> { total.textContent = formatTime(rgb.duration); };
  rgb.addEventListener('loadedmetadata',updateDuration);
  rgb.addEventListener('durationchange',updateDuration);
  if (rgb.readyState>=1) updateDuration();
  rgb.addEventListener('ended',()=> {
    const restart = playing;
    videos.forEach(video=> {video.currentTime=0;});
    if (restart) play();
  });
  progress.addEventListener('input',()=> {
    if (!Number.isFinite(rgb.duration)) return;
    seekActive = true;
    const time = (+progress.value/1000)*Math.max(0,rgb.duration-.04);
    videos.forEach(video=> { video.currentTime=time; });
    current.textContent=formatTime(time);
  });
  progress.addEventListener('change',()=> {seekActive=false;});
  videos.forEach(video=>video.addEventListener('error',()=> {
    pause();
    instruction.textContent='Video could not load. The full comparison is available below and in the project repository.';
  }));
  document.addEventListener('visibilitychange',()=> { if(document.hidden) pause(); });
  new IntersectionObserver(entries=> {
    if(!entries[0].isIntersecting) pause();
  },{threshold:0}).observe(demo);

  function createPanorama(canvas,video) {
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});
    if (!gl) throw new Error('WebGL is unavailable');
    const vertex=`attribute vec2 position; varying vec2 p; void main(){p=position;gl_Position=vec4(position,0.0,1.0);}`;
    const fragment=`precision mediump float; varying vec2 p; uniform sampler2D panorama; uniform vec2 rotation; uniform float aspect;
      void main(){
        vec3 ray=normalize(vec3(p.x*aspect*0.65,p.y*0.65,1.0));
        float cp=cos(rotation.y),sp=sin(rotation.y);
        ray=vec3(ray.x,cp*ray.y+sp*ray.z,-sp*ray.y+cp*ray.z);
        float cy=cos(rotation.x),sy=sin(rotation.x);
        ray=vec3(cy*ray.x+sy*ray.z,ray.y,-sy*ray.x+cy*ray.z);
        vec2 uv=vec2(fract(atan(ray.x,ray.z)/6.2831853+0.5),0.5-asin(clamp(ray.y,-1.0,1.0))/3.14159265);
        gl_FragColor=texture2D(panorama,uv);
      }`;
    const shader=(type,source)=> {
      const item=gl.createShader(type);gl.shaderSource(item,source);gl.compileShader(item);
      if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)) throw new Error('Panorama shader unavailable');
      return item;
    };
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Panorama renderer unavailable');
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const rotation=gl.getUniformLocation(program,'rotation');
    const aspect=gl.getUniformLocation(program,'aspect');
    let dragging=false,prevX=0,prevY=0;
    canvas.addEventListener('pointerdown',event=> {
      dragging=true;prevX=event.clientX;prevY=event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=> {
      if(!dragging)return;
      camera.yaw-=(event.clientX-prevX)*.006;
      camera.pitch=Math.max(-1.4,Math.min(1.4,camera.pitch+(event.clientY-prevY)*.006));
      prevX=event.clientX;prevY=event.clientY;
    });
    const endDrag=()=> {dragging=false;};
    canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
    canvas.addEventListener('keydown',event=> {
      const deltas={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
      if(!deltas[event.key])return;
      event.preventDefault();camera.yaw+=deltas[event.key][0];
      camera.pitch=Math.max(-1.4,Math.min(1.4,camera.pitch+deltas[event.key][1]));
    });
    return {draw(){
      if(video.readyState<2 || !canvas.clientWidth)return;
      const dpr=Math.min(devicePixelRatio||1,2);
      const width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,video);
      gl.uniform2f(rotation,camera.yaw,camera.pitch);gl.uniform1f(aspect,width/height);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }};
  }

  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=> {
    const requested=button.dataset.view==='sphere';
    if(requested&&!renderers.length){
      try {renderers=[createPanorama(document.querySelector('#rgb-sphere'),rgb),createPanorama(document.querySelector('#depth-sphere'),depth)];}
      catch(_){button.disabled=true;instruction.textContent='360° view is not supported by this browser. Panorama videos are available.';return;}
    }
    sphere=requested;demo.classList.toggle('sphere-mode',sphere);
    document.querySelectorAll('[data-view]').forEach(item=> {
      const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-pressed',String(selected));
    });
    instruction.textContent=sphere?'Drag either view to look around. Arrow keys also work.':'Panoramic input → temporally consistent relative depth.';
    if(sphere&&rgb.readyState<2){videos.forEach(video=> {video.preload='auto';video.load();});}
  }));

  function animate(time){
    if(playing){
      current.textContent=formatTime(rgb.currentTime);
      if(!seekActive&&Number.isFinite(rgb.duration))progress.value=Math.round(rgb.currentTime/rgb.duration*1000);
      if(time-lastSync>400){
        if(Math.abs(rgb.currentTime-depth.currentTime)>.08&&!depth.seeking)depth.currentTime=rgb.currentTime;
        lastSync=time;
      }
    }
    if(sphere&&!document.hidden)renderers.forEach(renderer=>renderer.draw());
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  if(!reducedMotion) {
    Promise.all(videos.map(video=>new Promise(resolve=> {
      if(video.readyState>=2)resolve();else video.addEventListener('loadeddata',resolve,{once:true});
      video.preload='auto';
    }))).then(()=> {
      if(sceneLoad===0&&pendingPlay===0&&!document.hidden&&demoVisible())play();
    });
  }

  const dialog=document.querySelector('#image-dialog');
  document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=> {
    dialog.querySelector('img').src=button.dataset.image;
    dialog.querySelector('img').alt=button.dataset.alt||'Enlarged PVDepth diagram';
    dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=> {if(event.target===dialog)dialog.close();});
  document.querySelector('#copy-citation').addEventListener('click',async event=> {
    const button=event.currentTarget;
    const citation=document.querySelector('#bibtex');
    try {
      await navigator.clipboard.writeText(citation.textContent);
      button.textContent='Copied ✓';document.querySelector('#copy-status').textContent='BibTeX copied to clipboard.';
      setTimeout(()=> {button.innerHTML='Copy BibTeX <span aria-hidden="true">⧉</span>';},2000);
    }catch(_){
      const range=document.createRange();range.selectNodeContents(citation);
      const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
      button.textContent='Selected — press Ctrl/Cmd+C';
      document.querySelector('#copy-status').textContent='BibTeX selected. Press Control C or Command C to copy.';
    }
  });
  const navigationLinks=[...document.querySelectorAll('nav a')];
  const sectionObserver=new IntersectionObserver(entries=> {
    entries.forEach(entry=> {if(entry.isIntersecting)navigationLinks.forEach(link=>link.classList.toggle('current',link.hash==='#'+entry.target.id));});
  },{rootMargin:'-15% 0px -60% 0px',threshold:0});
  document.querySelectorAll('main section[id]').forEach(section=>sectionObserver.observe(section));
})();
