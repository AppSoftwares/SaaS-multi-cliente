import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {MORGAN_NEGOCIO} from "@/lib/morgan-integration";
import {MORGAN_SOURCE} from "@/lib/morgan-source";
import {morganPaymentConfig,morganPayload,morganPreview,sendMorganText} from "@/lib/morgan-order-service";
async function owner(){const sb=await createClient(),{data:{user}}=await sb.auth.getUser();if(!user)return null;const {data}=await sb.from(MORGAN_SOURCE.members).select("id").eq("id",user.id).eq("negocio_id",MORGAN_NEGOCIO).eq("rol","ADMIN").maybeSingle();return data?sb:null}
export async function GET(){const actor=await owner();if(!actor)return NextResponse.json({error:"Acceso de administrador requerido"},{status:403});try{const sb=createAdminClient(),{data,error}=await sb.from(MORGAN_SOURCE.table).select("id,morgan_solicitud_id,morgan_cotizacion,morgan_total_centavos,morgan_total_bs,morgan_pago_aprobado_at,morgan_whatsapp_enviado_en").eq("negocio_id",MORGAN_NEGOCIO).not("morgan_solicitud_id","is",null).order(MORGAN_SOURCE.createdColumn,{ascending:false}).limit(100);if(error)throw Error("No se pudieron cargar los pedidos");return NextResponse.json({pedidos:data,config:await morganPaymentConfig()},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"No se pudo consultar Morgan"},{status:503})}}
export async function POST(req:Request){
 if(req.headers.get("origin")!==new URL(req.url).origin)return NextResponse.json({error:"Origen no permitido"},{status:403});
 const actor=await owner();if(!actor)return NextResponse.json({error:"Acceso de administrador requerido"},{status:403});
 try{const input=z.discriminatedUnion("accion",[z.object({accion:z.literal("configurar_pago"),instrucciones:z.string().trim().max(3000)}),z.object({accion:z.literal("aprobar"),id:z.string().uuid(),comprobante:z.string().trim().min(5).max(200)}),z.object({accion:z.literal("mensaje"),id:z.string().uuid()})]).parse(await req.json());
 const sb=createAdminClient();
 if(input.accion==="configurar_pago"){const {error}=await sb.from("negocios").update({morgan_pago_instrucciones:input.instrucciones||null}).eq("id",MORGAN_NEGOCIO);if(error)throw Error("No se pudieron guardar los datos de pago");return NextResponse.json({ok:true})}
 const {data:p,error}=await sb.from(MORGAN_SOURCE.table).select("id,morgan_cotizacion,morgan_total_centavos,morgan_total_bs,morgan_pago_aprobado_at").eq("id",input.id).eq("negocio_id",MORGAN_NEGOCIO).not("morgan_solicitud_id","is",null).single();if(error||!p)return NextResponse.json({error:"Pedido no encontrado"},{status:404});
 const q=morganPayload.parse(p.morgan_cotizacion);
 if(input.accion==="mensaje"){const preview=await morganPreview(q,p);if(!preview.paymentConfigured)throw Error("Completa los datos de pago antes de enviar el total");return NextResponse.json({mensaje:preview.mensaje,url:"https://wa.me/"+q.telefono+"?text="+encodeURIComponent(preview.mensaje)})}
 const {error:approve}=await actor.rpc("morgan_aprobar_pago",{p_id:input.id,p_comprobante:input.comprobante});if(approve)throw Error("No se pudo aprobar. Verifica el comprobante, el estado y los permisos.");
 const text="Pago aprobado en "+(await morganPaymentConfig()).brand+". Pedido #"+input.id.slice(0,8)+". "+(q.tipo_entrega==="retiro"?"El comercio coordinará contigo el retiro.":"El comercio coordinará contigo el envío.");
 const sent=p.morgan_pago_aprobado_at?{ok:false}:await sendMorganText(q.telefono,text);
 return NextResponse.json({ok:true,aviso:sent.ok?"Pago aprobado y aviso enviado.":"Pago aprobado. Puedes enviar el aviso por WhatsApp.",url:sent.ok?null:"https://wa.me/"+q.telefono+"?text="+encodeURIComponent(text)});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?"Datos inválidos":e instanceof Error?e.message:"No se pudo actualizar"},{status:409})}
}
