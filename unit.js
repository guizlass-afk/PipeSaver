(() => {
 'use strict';
 const key='pipesaver-unit',root=document.documentElement;
 let unit='mm';try{const value=localStorage.getItem(key);if(value==='mm'||value==='in')unit=value;}catch{}
 const labels={
 'pt-BR':['Usar polegadas','Usar milímetros'],'en-US':['Switch to inches','Switch to millimeters'],
 'es-ES':['Usar pulgadas','Usar milímetros'],'zh-CN':['切换到英寸','切换到毫米'],
 'hi-IN':['इंच में बदलें','मिलीमीटर में बदलें'],'ar-SA':['التبديل إلى البوصة','التبديل إلى المليمتر'],
 'fr-FR':['Passer en pouces','Passer en millimètres'],'bn-BD':['ইঞ্চিতে পরিবর্তন করুন','মিলিমিটারে পরিবর্তন করুন'],
 'ru-RU':['Переключить на дюймы','Переключить на миллиметры'],'de-DE':['Zu Zoll wechseln','Zu Millimeter wechseln'],
 'it-IT':['Passa a pollici','Passa a millimetri'],'ja-JP':['インチに切り替え','ミリメートルに切り替え']
 };
 let button;
 function refreshLabel(){if(!button)return;const inch=unit==='in',label=(labels[root.lang]||labels['pt-BR'])[inch?1:0];button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(inch));}
 function apply(){root.dataset.unit=unit;refreshLabel();document.dispatchEvent(new CustomEvent('unitchange',{detail:{unit}}));}
 apply();
 window.addEventListener('storage',event=>{if(event.key===key){unit=event.newValue==='in'?'in':'mm';apply();}});
 new MutationObserver(refreshLabel).observe(root,{attributes:true,attributeFilter:['lang']});
 document.addEventListener('DOMContentLoaded',()=>{
  const picker=document.getElementById('languagePicker');if(!picker)return;
  button=document.createElement('button');button.type='button';button.id='unitToggle';button.className='unit-toggle';
  button.innerHTML='<span class="unit-thumb" aria-hidden="true"></span><span class="unit-mm" aria-hidden="true">mm</span><span class="unit-in" aria-hidden="true">in</span>';
  picker.before(button);refreshLabel();button.addEventListener('click',()=>{unit=unit==='in'?'mm':'in';try{localStorage.setItem(key,unit);}catch{}apply();});
 });
})();
