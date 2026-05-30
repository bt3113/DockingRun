function P(px,z){let h=H*.365,s=250/(Math.max(1,z)+80);return{x:W*.5+px*s*7.5,y:h+(1-s)*H*.78,s}}
function rr(a,b,c,d,r){x.beginPath();x.moveTo(a+r,b);x.lineTo(a+c-r,b);x.quadraticCurveTo(a+c,b,a+c,b+r);x.lineTo(a+c,b+d-r);x.quadraticCurveTo(a+c,b+d,a+c-r,b+d);x.lineTo(a+r,b+d);x.quadraticCurveTo(a,b+d,a,b+d-r);x.lineTo(a,b+r);x.quadraticCurveTo(a,b,a+r,b)}
function loop(t){let dt=Math.min(.033,(t-last)/1000||0);last=t;if(state!=='playing'){g.dr+=dt*.7;g.d-=dt*4;if(g.d<1200)g.d=START}update(dt);render();requestAnimationFrame(loop)}
screen('menu');requestAnimationFrame(loop);