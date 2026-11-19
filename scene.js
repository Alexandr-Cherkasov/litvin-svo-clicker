(() => {
  'use strict';
  const canvas = document.querySelector('#city');
  const stage = canvas.parentElement;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
  if (!gl) {
    canvas.hidden = true;
    return;
  }

  const vertex = `
    attribute vec3 aPosition, aNormal, aColor;
    attribute float aMaterial;
    uniform vec3 uEye, uRight, uUp, uForward;
    uniform vec2 uLens;
    varying vec3 vPosition, vNormal, vColor;
    varying float vMaterial;
    void main() {
      vPosition = aPosition;
      vNormal = aNormal;
      vColor = aColor;
      vMaterial = aMaterial;
      vec3 relative = vPosition - uEye;
      float depth = dot(relative, uForward);
      gl_Position = vec4(dot(relative,uRight)*uLens.x, dot(relative,uUp)*uLens.y,
                         depth*1.0015-.18, depth);
    }`;
  const fragment = `
    precision highp float;
    uniform vec3 uEye;
    varying vec3 vPosition, vNormal, vColor;
    varying float vMaterial;
    float grain(vec2 p) {
      return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
    }
    void main() {
      vec3 n = normalize(vNormal);
      vec3 key = normalize(vec3(0.65,0.92,0.35));
      vec3 fill = normalize(vec3(-0.8,0.27,-0.62));
      float lit = max(dot(n,key),0.);
      float rim = max(dot(n,fill),0.);
      vec3 color = vColor*(0.54 + 0.48*lit) + rim*vec3(.026,.022,.067);
      if (vMaterial > 1.5 && vMaterial < 2.5) {
        color = vColor;
      } else if (vMaterial > 2.5 && vMaterial < 3.5) {
        vec2 p = vPosition.xz;
        float speckle = grain(floor(p*94.))*.022 + grain(floor(p*18.))*.018;
        float violet = exp(-abs(p.x+4.4)*.64)*exp(-abs(p.y+4.)*.085);
        float amber = exp(-abs(p.x-6.)*.53)*exp(-abs(p.y+3.)*.12);
        color += speckle + violet*vec3(.1,.046,.17) + amber*vec3(.17,.069,.076);
      }
      float d = length(uEye-vPosition);
      float fog = 1. - exp(-max(d-8.,0.)*.033);
      vec3 haze = mix(vec3(.28,.18,.38),vec3(.16,.12,.32),clamp(vPosition.y/14.,0.,1.));
      color = mix(color,haze,fog*.79);
      gl_FragColor = vec4(color,1.);
    }`;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
    return result;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  const uniforms = {};
  for (const name of ['Eye','Right','Up','Forward','Lens']) {
    uniforms[name] = gl.getUniformLocation(program, 'u' + name);
  }
  const attributes = ['Position','Normal','Color','Material'].map(name => gl.getAttribLocation(program, 'a' + name));

  const sub = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = a => {
    const length = Math.hypot(...a);
    return length ? a.map(value => value / length) : [0, 1, 0];
  };
  const rgb = hex => [16,8,0].map(shift => ((hex >> shift) & 255) / 255);

  class Geometry {
    data = [];

    triangle(a, b, c, color, material = 0, normal = unit(cross(sub(b,a), sub(c,a)))) {
      for (const point of [a,b,c]) this.data.push(...point, ...normal, ...color, material);
    }

    face(points, color, material = 0, normal) {
      for (let i = 1; i < points.length - 1; i++) {
        this.triangle(points[0], points[i], points[i+1], color, material, normal);
      }
    }

    box(x, y, z, w, h, d, color, material) {
      const x1 = x + w, y1 = y + h, z1 = z + d;
      const a = [x,y,z], b = [x1,y,z], c = [x1,y1,z], e = [x,y1,z];
      const f = [x,y,z1], g = [x1,y,z1], i = [x1,y1,z1], j = [x,y1,z1];
      for (const face of [[a,e,c,b],[f,g,i,j],[a,f,j,e],[b,c,i,g],[e,j,i,c],[a,b,g,f]]) this.face(face,color,material);
    }

    upload() {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);
      return { buffer, count: this.data.length / 10 };
    }
  }

  let seed = 69853;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const city = new Geometry();
  const sky = new Geometry();
  const ground = [[-125,0,-110],[-125,0,54],[95,0,54],[95,0,-110]];
  city.face(ground, rgb(0x403343), 3);
  // The back wall of the sky is a series of graduated emissive quads.
  const skyColors = [0x795276,0x7f547d,0x543969,0x2f264f,0x1a1935];
  for (let band = 0; band < skyColors.length - 1; band++) {
    const a = [-120,band*12,-77], b = [120,band*12,-77], c = [120,(band+1)*12,-77], d = [-120,(band+1)*12,-77];
    const vertices = [[a,band],[b,band],[c,band+1],[a,band],[c,band+1],[d,band+1]];
    for (const [point, color] of vertices) sky.data.push(...point, 0,0,1, ...rgb(skyColors[color]), 2);
  }
  for (let i=0; i<140; i++) {
    const x = -75 + random()*130, y = 5 + random()*38;
    const size = .017+random()*.022;
    sky.box(x,y,-76.9,size,size,.015,rgb(0xbaa0c4),2);
  }

  function tower(x, z, width, depth, floors, tone, warm) {
    const floor = .63;
    const height = floors * floor + .25;
    city.box(x,0,z,width,height,depth,rgb(tone));
    city.box(x-.08,height-.14,z-.08,width+.16,.14,depth+.16,rgb(0x342943));
    if (floors > 18) {
      city.box(x+width*.15,height,z+depth*.16,width*.7,.72,depth*.67,rgb(0x292237));
      city.box(x+width*.61,height+.71,z+depth*.6,.055,.69,.055,rgb(0x655374));
      city.box(x+width*.60,height+1.40,z+depth*.59,.11,.10,.11,rgb(0xf67f9d),2);
    }
    const windows = Math.max(3, Math.round(width/.64));
    const sideWindows = Math.max(3, Math.round(depth/.70));
    const colors = warm ? [0xf6c69d,0xc49292,0x916e8d,0xb99dc3] : [0xc1a8e5,0x8b83bb,0x6c648d,0xfcbea0];
    const dark = [0x2f2c47,0x3b3350,0x483851,0x302b40];
    for (let row = 0; row < floors; row++) {
      const bottom = row*floor + .18;
      if (row % 5 === 0) {
        city.box(x-.009,bottom-.105,z+depth+.01,width+.018,.033,.022,rgb(0x68526c));
        city.box(x+width+.018,bottom-.105,z,.02,.033,depth,rgb(0x584669));
      }
      for (let col = 0; col < windows + sideWindows; col++) {
        const corner = col >= windows;
        const spacing = corner ? depth / sideWindows : width / windows;
        const column = corner ? col - windows : col;
        const offset = (column+.13)*spacing;
        const lit = random() < (row === 0 ? .8 : .25);
        const palette = lit ? colors : dark;
        const color = rgb(palette[Math.floor(random()*palette.length)]);
        if (corner) city.box(x+width+.022,bottom,z+offset,.01,.34,spacing*.74,color,lit?2:0);
        else city.box(x+offset,bottom,z+depth+.022,spacing*.74,.34,.01,color,lit?2:0);
      }
    }
  }

  for (let i = 0; i < 22; i++) {
    tower(-70+i*5.4, -38 - random()*11, 3+random()*2, 2.7+random()*3, 12+Math.floor(random()*27), 0x362948, i%3===0);
  }
  tower(-22,-13,6,4.8,20,0x342c46,false);
  tower(-14.6,-16.9,5.2,4.1,26,0x332840,true);
  tower(-8.4,-15.3,4.7,4.4,16,0x352940,false);
  tower(-2,-18.2,5.3,5.0,31,0x30263f,false);
  tower(5.3,-19.4,4.7,4,23,0x342943,true);
  tower(10.9,-15.4,5.5,4.5,16,0x392b40,true);
  tower(17.6,-16.3,4.9,5.1,23,0x3f3043,false);

  // Curb, parking stalls, streetlights, and concrete barriers.
  city.box(-62,.01,-7.35,124,.14,1.4,rgb(0x635266));
  city.box(-62,.145,-5.95,124,.045,.13,rgb(0x9a7786));
  for (let x = -40; x <= 38; x += 3) {
    city.box(x,.006,-5.7,.05,.006,2.5,rgb(0x78657b),2);
    city.box(x,.112,-6,.77,.29,.38,rgb(0x74617b));
    city.box(x,.14,-5.613,.16,.065,.013,rgb(0xb28883),2);
  }
  for (let x = -50; x < 40; x += 2.35) {
    city.box(x,.009,4.47,1.48,.009,.057,rgb(0xa48a9e));
  }
  for (const x of [-17,-9.2,1.1,9.5,18]) {
    city.box(x,.14,-6.65,.12,4.65,.12,rgb(0x72637e));
    city.box(x,4.66,-6.65,.12,.11,.74,rgb(0x5b4a67));
    city.box(x-.14,4.60,-6.02,.41,.13,.33,rgb(0x63526f));
    city.box(x-.105,4.58,-5.99,.34,.027,.26,rgb(0xffc39e),2);
  }

  const background = city.upload();
  const heavens = sky.upload();
  const eye = [4.35,2.93,7.86];

  function draw(mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    const lengths = [3,3,3,1];
    attributes.forEach((location,index) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,lengths[index],gl.FLOAT,false,40,index*12);
    });
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width*ratio);
    canvas.height = Math.round(height*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);
    const aspect = width / height;
    const portrait = Math.min(1, Math.max(0, (1.2-aspect)/.65));
    const forward = unit(sub([.19,1.42+portrait*.47,.05],eye));
    const right = unit(cross(forward,[0,1,0]));
    const up = cross(right,forward);
    const lensY = Math.min(2.72, .90 + aspect*1.29);

    gl.clearColor(.12,.085,.2,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(uniforms.Eye,eye);
    gl.uniform3fv(uniforms.Right,right);
    gl.uniform3fv(uniforms.Up,up);
    gl.uniform3fv(uniforms.Forward,forward);
    gl.uniform2f(uniforms.Lens,lensY/aspect,lensY);
    draw(heavens);
    draw(background);
  }

  new ResizeObserver(resize).observe(stage);
  resize();
})();
