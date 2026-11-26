// HUD + instrument cluster + menu screens, drawn on a 2D canvas laid
// over the WebGL view. Everything the judge needs to see at a glance:
// altitude, speed and heading in big lit numerals, a compass strip, an
// artificial horizon, throttle and fuel gauges, ring counter and score.
import { CFG } from './config.js';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 800;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function panel(x, y, w, h, r = 10) {
    ctx.fillStyle = 'rgba(8, 18, 30, 0.62)';
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }
  function label(text, x, y, size = 11, color = '#8fd8ff') {
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }
  function bigNum(text, x, y, size = 30, color = '#eaf7ff') {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(80, 200, 255, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function compass(headingDeg, w, h) {
    const cx = w / 2;
    panel(cx - 170, 12, 340, 46);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - 170, 12, 340, 46, 10);
    ctx.clip();
    const pxPerDeg = 3;
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round((headingDeg + d) / 5) * 5;
      const norm = ((deg % 360) + 360) % 360;
      const x = cx + (deg - headingDeg) * pxPerDeg;
      const major = norm % 30 === 0;
      ctx.strokeStyle = major ? '#eaf7ff' : 'rgba(160, 220, 255, 0.5)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x, major ? 40 : 32);
      ctx.stroke();
      if (major) {
        const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
        ctx.fillStyle = '#eaf7ff';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(names[norm] ?? String(norm).padStart(3, '0'), x, 54);
      }
    }
    ctx.restore();
    // Centre caret.
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(cx, 14);
    ctx.lineTo(cx - 6, 22);
    ctx.lineTo(cx + 6, 22);
    ctx.closePath();
    ctx.fill();
    const hdg = String(Math.round(headingDeg)).padStart(3, '0');
    ctx.fillStyle = '#ffb020';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${hdg}°`, cx, 72);
  }

  function artificialHorizon(x, y, r, pitch, roll) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-roll);
    const dy = pitch * r * 1.4;
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(-r, -r + dy, r * 2, r);
    ctx.fillStyle = '#7a5b33';
    ctx.fillRect(-r, dy, r * 2, r);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-r, dy - 1, r * 2, 2);
    ctx.rotate(roll);
    ctx.restore();
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r + 6, y);
    ctx.lineTo(x - 12, y);
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + r - 6, y);
    ctx.stroke();
    label('ATTITUDE', x - r + 4, y + r + 16, 10);
  }

  function gauge(x, y, w, h, frac, color, title, text) {
    panel(x, y - 20, w, h + 20, 6);
    label(title, x + 8, y - 6, 11);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * frac), h - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(text, x + w - 6, y + h - 6);
    ctx.textAlign = 'left';
  }

  function draw(world, screen, cameraMode, best, muted) {
    resize();
    const s = world.state;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const fwd = world.forward();
    const headingDeg = ((Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI + 360) % 360;
    const altM = Math.max(0, s.y);
    const spdKmh = Math.round(s.speed * 3.6);
    const vsMs = s.vspeed;

    if (screen === 'title') {
      // Title over the live attract flight.
      ctx.fillStyle = 'rgba(6, 14, 26, 0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb020';
      ctx.font = '800 64px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(255, 176, 32, 0.7)';
      ctx.shadowBlur = 24;
      ctx.fillText('NUSA SKY COURIER', w / 2, h * 0.30);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eaf7ff';
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillText('A mail plane, a volcano island, eight gold rings — and home.', w / 2, h * 0.30 + 38);
      const missions = world.MISSIONS;
      missions.forEach((m, i) => {
        const y = h * 0.46 + i * 64;
        ctx.fillStyle = i === 0 ? 'rgba(255, 176, 32, 0.16)' : 'rgba(8, 18, 30, 0.55)';
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.5)';
        ctx.beginPath();
        ctx.roundRect(w / 2 - 320, y - 30, 640, 52, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#eaf7ff';
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${m.key}. ${m.name}`, w / 2 - 300, y + 7);
        ctx.fillStyle = '#9fd4ef';
        ctx.font = '400 15px system-ui, sans-serif';
        ctx.fillText(m.blurb, w / 2 - 300, y + 27);
      });
      ctx.fillStyle = '#cfeaff';
      ctx.font = '500 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('W/S pitch · A/D bank · Shift/Ctrl throttle · drag mouse to steer · C camera · P pause', w / 2, h * 0.46 + 3 * 64 + 22);
      ctx.fillText('Press 1, 2 or 3 to pick a mission — or Space to fly the Ring Run', w / 2, h * 0.46 + 3 * 64 + 48);
      if (best > 0) {
        ctx.fillStyle = '#ffb020';
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.fillText(`Best score: ${best}`, w / 2, h * 0.46 + 3 * 64 + 78);
      }
      return;
    }

    // --- In-flight HUD (play / paused / over / complete) ---
    compass(headingDeg, w, h);

    // Left cluster: ALT / SPD / V/S.
    panel(16, 12, 210, 118);
    label('ALTITUDE', 30, 34);
    bigNum(`${Math.round(altM)} m`, 30, 66);
    label('SPEED', 30, 92);
    bigNum(`${spdKmh} km/h`, 30, 120, 24);
    ctx.fillStyle = vsMs >= 0 ? '#7dff9e' : '#ff9d7d';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${vsMs >= 0 ? '+' : ''}${vsMs.toFixed(1)} m/s`, 212, 92);
    ctx.textAlign = 'left';

    // Right cluster: rings, score, fuel, throttle.
    panel(w - 226, 12, 210, 118);
    label('RINGS', w - 212, 34);
    bigNum(`${s.ringIndex}/${s.rings.length}`, w - 212, 66);
    label('SCORE', w - 212, 92);
    bigNum(`${s.score}`, w - 212, 120, 24);
    gauge(w - 226, 146, 210, 18, s.fuel / CFG.FUEL_MAX, s.fuel < 25 ? '#ff5a4e' : '#ffb020', 'FUEL', `${Math.round(s.fuel)}%`);
    gauge(w - 226, 186, 210, 18, s.throttle, '#37c8ff', 'THROTTLE', `${Math.round(s.throttle * 100)}%`);
    if (s.damage > 0) {
      gauge(w - 226, 226, 210, 18, 1 - s.damage / 100, '#ff5a4e', 'HULL', `${100 - Math.round(s.damage)}%`);
    }

    // Bottom-left: attitude + next-ring bearing.
    artificialHorizon(92, h - 92, 62, s.pitch, s.roll);
    const ring = s.rings[s.ringIndex];
    if (ring && screen === 'play') {
      const dx = ring.x - s.x;
      const dz = ring.z - s.z;
      const dist = Math.round(Math.hypot(dx, ring.y - s.y, dz));
      const bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      let rel = ((bearing - headingDeg + 540) % 360) - 180;
      panel(170, h - 130, 250, 76);
      label('NEXT RING', 184, h - 108);
      ctx.fillStyle = '#ffd34d';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(`${dist} m  ${rel >= 0 ? '↻' : '↺'} ${Math.abs(Math.round(rel))}°`, 184, h - 78);
      label(s.mission.id === 'island-hop' ? 'Follow the gold ring to the next strip' : 'Thread the gold ring', 184, h - 58, 11, '#9fd4ef');
    }

    // Mission + time, bottom-right.
    panel(w - 226, h - 62, 210, 46);
    label(s.mission.name.toUpperCase(), w - 212, h - 40, 11, '#ffb020');
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(world.fmtTime(s.elapsed), w - 212, h - 20);

    // Centre message banner.
    if (s.message && s.messageUntil > 0 && screen === 'play') {
      ctx.font = '700 24px system-ui, sans-serif';
      const tw = ctx.measureText(s.message).width;
      panel(w / 2 - tw / 2 - 20, h * 0.22, tw + 40, 48, 12);
      ctx.fillStyle = '#ffe9b0';
      ctx.textAlign = 'center';
      ctx.fillText(s.message, w / 2, h * 0.22 + 32);
      ctx.textAlign = 'left';
    }
    // Stall + fuel warnings.
    if (screen === 'play' && s.speed < CFG.MIN_SPEED && !s.onGround) {
      ctx.fillStyle = '#ff5a4e';
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff5a4e';
      ctx.shadowBlur = 14;
      ctx.fillText('⚠ STALL — NOSE DOWN, FULL THROTTLE', w / 2, h * 0.34);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
    if (screen === 'play' && s.fuel < 20 && s.fuel > 0) {
      ctx.fillStyle = '#ffb020';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL', w / 2, h * 0.34 + 28);
      ctx.textAlign = 'left';
    }
    // Camera + mute hints, bottom centre.
    ctx.fillStyle = 'rgba(207, 234, 255, 0.75)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Camera: ${cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE'} (C)  ·  ${muted ? 'Muted (M)' : 'Sound on (M)'}  ·  P pause  ·  R restart`, w / 2, h - 14);
    ctx.textAlign = 'left';

    if (screen === 'paused') {
      ctx.fillStyle = 'rgba(6, 14, 26, 0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#eaf7ff';
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', w / 2, h / 2 - 10);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillText('P or Space to keep flying · R to restart the mission', w / 2, h / 2 + 24);
      ctx.textAlign = 'left';
    }
    if (screen === 'over') {
      // Text sits in the upper third so the wrecked plane and the
      // runway stay visible below it.
      ctx.fillStyle = 'rgba(20, 6, 8, 0.42)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff6b5e';
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CRASHED', w / 2, h * 0.30);
      ctx.fillStyle = '#eaf7ff';
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillText(s.overReason, w / 2, h * 0.30 + 34);
      ctx.fillText(`Score ${s.score}  ·  Rings ${s.ringIndex}/${s.rings.length}  ·  Best ${best}`, w / 2, h * 0.30 + 66);
      ctx.fillText('Press R to fly again, or 1/2/3 for another mission', w / 2, h * 0.30 + 98);
      ctx.textAlign = 'left';
    }
    if (screen === 'complete') {
      ctx.fillStyle = 'rgba(6, 26, 14, 0.42)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#7dff9e';
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MISSION COMPLETE', w / 2, h * 0.30);
      ctx.fillStyle = '#eaf7ff';
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillText(s.overReason, w / 2, h * 0.30 + 34);
      ctx.fillText(`Score ${s.score}  ·  Time ${world.fmtTime(s.elapsed)}  ·  Best ${best}`, w / 2, h * 0.30 + 66);
      ctx.fillText('Press R to fly again, or 1/2/3 for another mission', w / 2, h * 0.30 + 98);
      ctx.textAlign = 'left';
    }
  }

  return { draw };
}
