// ============================================
// SIMPLE LANDING - BLACK SCREEN, WHITE CIRCLE
// ============================================

const canvas = document.getElementById('canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ============================================
// WHITE CIRCLE
// ============================================

const circleGeometry = new THREE.CircleGeometry(2, 64);
const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const circle = new THREE.Mesh(circleGeometry, circleMaterial);
circle.position.set(0, 0, 0);
scene.add(circle);

// ============================================
// "ENTER" TEXT
// ============================================

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

const enterText = createTextSprite('enter');
enterText.position.set(0, 0, 0.1);
scene.add(enterText);

// ============================================
// FLOATING ANIMATION
// ============================================

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.016;

  // Gentle floating motion
  circle.position.y = Math.sin(time * 0.8) * 0.15;
  enterText.position.y = circle.position.y;

  renderer.render(scene, camera);
}

animate();

// ============================================
// RESIZE
// ============================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
