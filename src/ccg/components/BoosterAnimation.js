import React, { Component } from 'react';

class Particle {
  constructor(options) {
    const defaults = { x:0, y:0, radius:10, direction:0, velocity:0, explode:false };
    Object.assign(this, defaults, options);
    this.velX = Math.cos(this.direction) * this.velocity;
    this.velY = Math.sin(this.direction) * this.velocity;
    this.friction = 0.9;
    this.decay = this.randomBetween(90,91) * 0.01;
    this.gravity = this.radius * 0.01;
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.velX *= this.friction;
    this.velY *= this.friction;
    this.velocity *= this.friction;
    this.radius *= this.decay;
    this.gravity += 0.05;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fill();
  }
  randomBetween(min, max) {
    return Math.floor(Math.random()*(max-min+1))+min;
  }
}

class BoosterAnimation extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.particles = [];
    this.rafId = null;
  }

  componentDidMount() {
    this.canvas = this.canvasRef.current;
    this.ctx = this.canvas.getContext('2d');
    this.setStage();
    window.addEventListener('resize', this.setStage);
  }

  componentDidUpdate(prev) {
    if (!prev.visible && this.props.visible) {
      this.loop();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.setStage);
    cancelAnimationFrame(this.rafId);
  }

  setStage = () => {
    this.clear();
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
  };

  clear = () => {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'hsla(0, 0%, 0%, 0.5)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = 'lighter';
  };

  createParticles = (x, y) => {
    let n = 50;
    while (n--) {
      const dir = Math.random()*Math.PI*2;
      const vel = this.randomBetween(10,20);
      const rad = 10 + Math.random()*20;
      const p = new Particle({ x, y, direction: dir, velocity: vel, radius: rad, explode:true });
      this.particles.push(p);
    }
  };

  loop = () => {
    this.clear();
    this.particles.forEach((p, i) => {
      p.update();
      p.draw(this.ctx);
    });
    if (this.particles.length > 0) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  triggerExplosion = (x, y) => {
    this.createParticles(x, y);
    if (!this.rafId) this.loop();
  };

  boom = (e) => {
    this.createParticles(e.clientX, e.clientY);
  };

  randomBetween = (min, max) => Math.floor(Math.random()*(max-min+1))+min;

  render() {
    return (
      <canvas
        ref={this.canvasRef}
        style={{ width:'100%', height:'100%', display: this.props.visible ? 'block' : 'none' }}
        onMouseDown={this.boom}
      />
    );
  }
}

export default BoosterAnimation;
