import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
export const MORGAN_NEGOCIO="98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5";
export function authorizeMorgan(req:Request){
 const key=process.env.MORGAN_INTEGRATION_TOKEN,token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(!key||Buffer.byteLength(token)!==Buffer.byteLength(key)||!timingSafeEqual(Buffer.from(token),Buffer.from(key)))return NextResponse.json({error:"No autorizado"},{status:401});
 if(Number(req.headers.get("content-length")||0)>32000)return NextResponse.json({error:"Solicitud demasiado grande"},{status:413});return null;
}
