import {createRequestHandler} from 'react-router';
import {api} from '../server/api';
import * as build from 'virtual:react-router/server-build';
const handler=createRequestHandler(build,'production');
export default {async fetch(request:Request,env:any,ctx:ExecutionContext){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api.fetch(request,env,ctx);return handler(request,{cloudflare:{env,ctx}})}};
