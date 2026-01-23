// ============================================
// THREE.JS SETUP
// ============================================

const canvas = document.getElementById('canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

camera.position.z = 5;

// ============================================
// CREATE 3D OBJECTS
// ============================================

// Floating particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 500;
const positions = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 20;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particlesMaterial = new THREE.PointsMaterial({
  size: 0.02,
  color: 0xffffff,
  transparent: true,
  opacity: 0.8,
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// Floating torus (donut shape)
const torusGeometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
const torusMaterial = new THREE.MeshBasicMaterial({
  color: 0x6366f1,
  wireframe: true,
});
const torus = new THREE.Mesh(torusGeometry, torusMaterial);
torus.position.x = 3;
scene.add(torus);

// Floating icosahedron (20-sided shape)
const icoGeometry = new THREE.IcosahedronGeometry(1, 0);
const icoMaterial = new THREE.MeshBasicMaterial({
  color: 0x22d3ee,
  wireframe: true,
});
const icosahedron = new THREE.Mesh(icoGeometry, icoMaterial);
icosahedron.position.x = -3;
scene.add(icosahedron);

// ============================================
// ANIMATION LOOP
// ============================================

let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

function animate() {
  requestAnimationFrame(animate);

  // Rotate objects
  torus.rotation.x += 0.01;
  torus.rotation.y += 0.005;

  icosahedron.rotation.x -= 0.005;
  icosahedron.rotation.y += 0.01;

  particles.rotation.y += 0.0005;

  // Subtle camera movement following mouse
  camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
  camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.05;
  camera.lookAt(scene.position);

  renderer.render(scene, camera);
}

animate();

// ============================================
// RESIZE HANDLER
// ============================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// GSAP ANIMATIONS
// ============================================

gsap.registerPlugin(ScrollTrigger);

// Hero text entrance animation
gsap.to('.title', {
  opacity: 1,
  y: 0,
  duration: 1.2,
  ease: 'power3.out',
  delay: 0.3,
});

gsap.to('.subtitle', {
  opacity: 1,
  y: 0,
  duration: 1,
  ease: 'power3.out',
  delay: 0.6,
});

// Scroll-triggered animations for sections
gsap.utils.toArray('.section').forEach((section) => {
  gsap.from(section.querySelectorAll('h2, p'), {
    scrollTrigger: {
      trigger: section,
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
    opacity: 0,
    y: 50,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power2.out',
  });
});

// Move 3D objects based on scroll
ScrollTrigger.create({
  trigger: '.content',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    const progress = self.progress;

    // Move torus based on scroll
    torus.position.y = -progress * 5;
    torus.rotation.z = progress * Math.PI;

    // Move icosahedron opposite
    icosahedron.position.y = progress * 5 - 2;
    icosahedron.rotation.z = -progress * Math.PI;

    // Zoom camera slightly on scroll
    camera.position.z = 5 - progress * 2;
  },
});
