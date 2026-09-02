/* VexaAccount notification context: bounded, deduplicated, single-provider toasts. */
(function(global,React){
  'use strict';
  if(!React||global.__VEXA_NOTIFICATION_CORE_V2__) return;
  global.__VEXA_NOTIFICATION_CORE_V2__=true;
  const {createContext,useContext,useState,useCallback,useRef,useEffect}=React;
  const NotificationContext=createContext(null);
  const MAX_TOASTS=4;
  const DEDUPE_MS=1800;
  function NotificationProvider(props){
    const [toasts,setToasts]=useState([]),timers=useRef(new Map()),recent=useRef(new Map());
    const removeToast=useCallback(id=>{
      setToasts(p=>p.filter(t=>t.id!==id));
      const timer=timers.current.get(id); if(timer) clearTimeout(timer);
      timers.current.delete(id);
    },[]);
    const showToast=useCallback((message,type='info',duration=4000)=>{
      const text=String(message??'').trim(); if(!text) return null;
      const key=`${type}:${text}`;
      const now=Date.now(),previous=recent.current.get(key)||0;
      if(now-previous<DEDUPE_MS) return null;
      recent.current.set(key,now);
      for(const [k,t] of recent.current){if(now-t>DEDUPE_MS)recent.current.delete(k)}
      const id=`${now}-${Math.random().toString(36).slice(2)}`;
      setToasts(p=>{
        const next=[...p,{id,message:text,type}];
        while(next.length>MAX_TOASTS){const oldest=next.shift();const timer=timers.current.get(oldest.id);if(timer)clearTimeout(timer);timers.current.delete(oldest.id)}
        return next;
      });
      timers.current.set(id,setTimeout(()=>removeToast(id),Math.max(500,duration)));
      return id;
    },[removeToast]);
    const showSuccess=useCallback((m,d=4000)=>showToast(m,'success',d),[showToast]);
    const showError=useCallback((m,d=5000)=>showToast(m,'error',d),[showToast]);
    const showWarning=useCallback((m,d=4000)=>showToast(m,'warning',d),[showToast]);
    const showInfo=useCallback((m,d=3000)=>showToast(m,'info',d),[showToast]);
    useEffect(()=>{
      global.vexaReactNotify={showToast,showSuccess,showError,showWarning,showInfo};
      return()=>{
        if(global.vexaReactNotify?.showToast===showToast) delete global.vexaReactNotify;
        timers.current.forEach(clearTimeout); timers.current.clear(); recent.current.clear();
      };
    },[showToast,showSuccess,showError,showWarning,showInfo]);
    return React.createElement(NotificationContext.Provider,{value:{toasts,showToast,showSuccess,showError,showWarning,showInfo,removeToast}},props.children);
  }
  function useNotification(){const c=useContext(NotificationContext);if(!c)throw new Error('useNotification must be used within NotificationProvider');return c}
  global.VexaNotificationCore={NotificationContext,NotificationProvider,useNotification};
})(window,window.React);
