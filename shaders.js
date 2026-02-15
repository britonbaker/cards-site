// ============================================
// WEBGL SHADER BACKGROUNDS + ASCII OVERLAY
// ============================================

const ShaderCards = (() => {
  // Reusable WebGL helper — creates a full-screen quad with a fragment shader
  function createShaderContext(canvas, fragSource) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return null;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSource);
    gl.compileShader(fs);
    if (!gl.getShaderInfoLog(fs) === '') console.warn(gl.getShaderInfoLog(fs));

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    return {
      gl, prog,
      uni: (name) => gl.getUniformLocation(prog, name),
      draw() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    };
  }

  // ASCII density ramp (dark → light)
  const ASCII_RAMP = '@%#W8&Oo=+~-:. ';

  // Convert canvas pixels to ASCII text
  function canvasToAscii(canvas, cols) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) || 
                (() => { const c = document.createElement('canvas'); return c.getContext('2d'); })();
    // Use a temp 2d canvas to read WebGL pixels
    const w = canvas.width, h = canvas.height;
    const aspect = h / w;
    const rows = Math.round(cols * aspect * 0.5); // chars are ~2:1
    const tmp = document.createElement('canvas');
    tmp.width = cols; tmp.height = rows;
    const tc = tmp.getContext('2d');
    tc.drawImage(canvas, 0, 0, cols, rows);
    const data = tc.getImageData(0, 0, cols, rows).data;
    let out = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
        out += ASCII_RAMP[Math.floor((1 - lum) * (ASCII_RAMP.length - 1))];
      }
      out += '\n';
    }
    return out;
  }

  // Common noise function used in all shaders
  const NOISE_GLSL = `
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
    vec3 permute(vec3 x){return mod289((x*34.+1.)*x);}
    float snoise(vec2 v){
      const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
      vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx),i1;
      i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
      vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
      i=mod289(i);
      vec3 p=permute(permute(i.y+vec3(0,i1.y,1.))+i.x+vec3(0,i1.x,1.));
      vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
      m=m*m;m=m*m;
      vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,ox=floor(x+.5),a0=x-ox;
      m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
      vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.*dot(m,g);
    }
  `;

  // ---- CUBE RUNNER: Neon grid / matrix rain ----
  const FRAG_CUBE_RUNNER = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    ${NOISE_GLSL}
    void main(){
      vec2 uv = gl_FragCoord.xy / u_resolution;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;

      // Mouse ripple
      vec2 m = u_mouse * 2.0 - 1.0;
      m.x *= u_resolution.x / u_resolution.y;
      float d = length(p - m);
      float ripple = sin(d * 20.0 - u_time * 4.0) * exp(-d * 3.0) * 0.15;

      // Perspective grid
      float gy = 1.0 / (abs(p.y + 0.2) + 0.1);
      float gx = sin((p.x + ripple) * 10.0 * gy) * 0.5 + 0.5;
      float lines = smoothstep(0.0, 0.08, abs(fract(gy * 0.3 - u_time * 0.5) - 0.5));
      float grid = (1.0 - lines) * step(0.0, -p.y - 0.2) * 0.6;
      grid += (1.0 - smoothstep(0.45, 0.5, gx)) * step(0.0, -p.y - 0.2) * 0.3 * (1.0 - lines);

      // Matrix rain columns
      float col = floor((uv.x + ripple * 0.5) * 30.0);
      float rain = fract(snoise(vec2(col, 0.0)) + u_time * (0.3 + fract(col * 0.17) * 0.5));
      float drop = smoothstep(rain, rain - 0.25, uv.y) * smoothstep(rain - 0.35, rain - 0.25, uv.y);

      // Color mix: cyan, magenta, purple
      vec3 cyan = vec3(0.0, 0.9, 1.0);
      vec3 magenta = vec3(0.9, 0.1, 0.8);
      vec3 purple = vec3(0.4, 0.1, 0.7);

      vec3 col3 = mix(purple, cyan, grid) + magenta * drop * 0.7;
      col3 += cyan * grid * 0.5;

      // Vignette
      float vig = 1.0 - length(uv - 0.5) * 0.8;
      col3 *= vig;

      gl_FragColor = vec4(col3, 1.0);
    }
  `;

  // ---- RING WORLD: Flowing noise terrain ----
  const FRAG_RING_WORLD = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    ${NOISE_GLSL}
    void main(){
      vec2 uv = gl_FragCoord.xy / u_resolution;
      vec2 p = uv * 4.0;

      // Mouse push effect
      vec2 m = u_mouse * 4.0;
      float md = length(p - m);
      vec2 push = normalize(p - m + 0.001) * exp(-md * 0.8) * 0.6;
      p += push;

      // Layered noise for terrain
      float n = snoise(p + vec2(u_time * 0.15, u_time * 0.1)) * 0.5
              + snoise(p * 2.0 + vec2(-u_time * 0.1, u_time * 0.2)) * 0.25
              + snoise(p * 4.0 + u_time * 0.05) * 0.125;

      // Warm sunset palette
      vec3 gold = vec3(1.0, 0.75, 0.2);
      vec3 orange = vec3(1.0, 0.4, 0.1);
      vec3 blue = vec3(0.1, 0.2, 0.5);
      vec3 sky = vec3(0.3, 0.5, 0.8);

      float t = n * 0.5 + 0.5;
      vec3 col = mix(blue, orange, smoothstep(0.3, 0.6, t));
      col = mix(col, gold, smoothstep(0.55, 0.8, t));
      col = mix(col, sky, smoothstep(0.0, 0.3, uv.y) * 0.4);

      // Horizon glow
      float horizon = exp(-abs(uv.y - 0.4) * 5.0) * 0.3;
      col += gold * horizon;

      // Vignette
      col *= 1.0 - length(uv - 0.5) * 0.6;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // ---- CRYSTAL CORE: Geometric fractal with sparkle ----
  const FRAG_CRYSTAL_CORE = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    ${NOISE_GLSL}
    void main(){
      vec2 uv = gl_FragCoord.xy / u_resolution;
      vec2 p = (uv - 0.5) * 2.0;
      p.x *= u_resolution.x / u_resolution.y;

      // Mouse illumination
      vec2 m = (u_mouse - 0.5) * 2.0;
      m.x *= u_resolution.x / u_resolution.y;
      float mDist = length(p - m);
      float illuminate = exp(-mDist * 2.0) * 0.5;

      // Kaleidoscope fold
      float angle = atan(p.y, p.x);
      float r = length(p);
      float k = 6.0;
      angle = mod(angle, 3.14159 * 2.0 / k);
      angle = abs(angle - 3.14159 / k);
      p = vec2(cos(angle), sin(angle)) * r;

      // Crystal pattern
      float crystal = 0.0;
      vec2 q = p;
      for(int i = 0; i < 4; i++){
        q = abs(q) - 0.5;
        q *= 1.3;
        q = q * mat2(cos(u_time*0.1+float(i)), -sin(u_time*0.1+float(i)), 
                      sin(u_time*0.1+float(i)), cos(u_time*0.1+float(i)));
        crystal += exp(-abs(q.x + q.y) * 3.0) * 0.3;
      }

      // Sparkle
      float sparkle = snoise(uv * 40.0 + u_time * 2.0);
      sparkle = pow(max(sparkle, 0.0), 8.0) * 2.0;

      // Color: deep red, purple, pink
      vec3 red = vec3(0.8, 0.1, 0.2);
      vec3 purple = vec3(0.5, 0.1, 0.6);
      vec3 pink = vec3(1.0, 0.4, 0.6);
      vec3 white = vec3(1.0);

      vec3 col = mix(purple, red, crystal);
      col += pink * crystal * 0.5;
      col += white * sparkle * 0.3;
      col += pink * illuminate;

      // Vignette
      col *= 1.0 - length(uv - 0.5) * 0.7;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const SHADERS = [FRAG_CUBE_RUNNER, FRAG_RING_WORLD, FRAG_CRYSTAL_CORE];
  const instances = []; // {ctx, canvas, asciiEl, mouse, visible}
  let rafId = null;

  function initCard(cardEl, index) {
    // Create shader canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'shader-canvas';
    canvas.width = 220; canvas.height = 300;

    // Create ASCII overlay
    const ascii = document.createElement('pre');
    ascii.className = 'ascii-overlay';

    // Insert into card (before gradient)
    const cardImage = cardEl.querySelector('.card-image');
    cardEl.insertBefore(canvas, cardImage.nextSibling);
    cardEl.insertBefore(ascii, canvas.nextSibling);

    // Hide original image
    cardImage.style.display = 'none';

    const ctx = createShaderContext(canvas, SHADERS[index]);
    if (!ctx) return;

    const inst = {
      ctx, canvas, asciiEl: ascii,
      mouse: { x: 0.5, y: 0.5 },
      visible: true
    };
    instances[index] = inst;

    // Mouse tracking (relative to card)
    cardEl.addEventListener('mousemove', (e) => {
      const r = cardEl.getBoundingClientRect();
      inst.mouse.x = (e.clientX - r.left) / r.width;
      inst.mouse.y = 1.0 - (e.clientY - r.top) / r.height;
    });

    cardEl.addEventListener('mouseleave', () => {
      // Smooth return handled by shader
    });
  }

  // Visibility observer
  let observer = null;
  function setupVisibility() {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const idx = Number(e.target.dataset.index);
        if (instances[idx]) instances[idx].visible = e.isIntersecting;
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.card').forEach(c => observer.observe(c));
  }

  // Temp canvas for reading WebGL pixels
  let readCanvas = null;
  let readCtx = null;

  function renderLoop(time) {
    rafId = requestAnimationFrame(renderLoop);
    const t = time * 0.001;

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      if (!inst || !inst.visible) continue;

      const { ctx, canvas, asciiEl, mouse } = inst;
      const gl = ctx.gl;

      // Resize canvas to match card
      const card = canvas.parentElement;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      // Set uniforms
      gl.uniform1f(ctx.uni('u_time'), t);
      gl.uniform2f(ctx.uni('u_resolution'), w, h);
      gl.uniform2f(ctx.uni('u_mouse'), mouse.x, mouse.y);

      ctx.draw();

      // ASCII conversion (every other frame for perf)
      if (Math.floor(time / 33) % 2 === 0) {
        // Read WebGL to temp 2d canvas
        if (!readCanvas) {
          readCanvas = document.createElement('canvas');
          readCtx = readCanvas.getContext('2d');
        }
        readCanvas.width = w;
        readCanvas.height = h;
        readCtx.drawImage(canvas, 0, 0);

        const cols = 50;
        const aspect = h / w;
        const rows = Math.round(cols * aspect * 0.5);
        const tmp = document.createElement('canvas');
        tmp.width = cols; tmp.height = rows;
        const tc = tmp.getContext('2d');
        tc.drawImage(readCanvas, 0, 0, cols, rows);
        const data = tc.getImageData(0, 0, cols, rows).data;

        let out = '';
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const idx = (y * cols + x) * 4;
            const lum = (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
            out += ASCII_RAMP[Math.floor((1 - lum) * (ASCII_RAMP.length - 1))];
          }
          out += '\n';
        }
        asciiEl.textContent = out;
      }
    }
  }

  function init() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, i) => initCard(card, i));
    setupVisibility();
    rafId = requestAnimationFrame(renderLoop);
  }

  // Pause/resume when cards section is hidden (game is playing)
  function pause() {
    instances.forEach(inst => { if (inst) inst.visible = false; });
  }

  function resume() {
    instances.forEach(inst => { if (inst) inst.visible = true; });
  }

  return { init, pause, resume };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ShaderCards.init();
});
