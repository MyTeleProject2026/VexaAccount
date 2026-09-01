/* VexaTrade-compatible React notification context for the static VexaAccount frontend. */
(function(global,React){
  'use strict';
  if(!React) return;
  const {createContext,useContext,useState,useCallback,useRef,useEffect}=React;
  const NotificationContext=createContext(null);
  function NotificationProvider(props){
    const [toasts,setToasts]=useState([]),timers=useRef(new Map());
    const removeToast=useCallback(id=>{setToasts(p=>p.filter(t=>t.id!==id));const t=timers.current.get(id);if(t)clearTimeout(t);timers.current.delete(id)},[]);
    const showToast=useCallback((message,type='info',duration=4000)=>{const id=Date.now()+Math.random();setToasts(p=>[...p,{id,message:String(message),type}]);timers.current.set(id,setTimeout(()=>removeToast(id),duration));return id},[removeToast]);
    const showSuccess=useCallback((m,d=4000)=>showToast(m,'success',d),[showToast]);
    const showError=useCallback((m,d=5000)=>showToast(m,'error',d),[showToast]);
    const showWarning=useCallback((m,d=4000)=>showToast(m,'warning',d),[showToast]);
    const showInfo=useCallback((m,d=3000)=>showToast(m,'info',d),[showToast]);
    useEffect(()=>{global.vexaReactNotify={showToast,showSuccess,showError,showWarning,showInfo};return()=>{if(global.vexaReactNotify&&global.vexaReactNotify.showToast===showToast)delete global.vexaReactNotify;timers.current.forEach(clearTimeout);timers.current.clear();}},[showToast,showSuccess,showError,showWarning,showInfo]);
    return React.createElement(NotificationContext.Provider,{value:{toasts,showToast,showSuccess,showError,showWarning,showInfo,removeToast}},props.children);
  }
  function useNotification(){const c=useContext(NotificationContext);if(!c)throw new Error('useNotification must be used within NotificationProvider');return c}
  global.VexaNotificationCore={NotificationContext,NotificationProvider,useNotification};
})(window,window.React);
