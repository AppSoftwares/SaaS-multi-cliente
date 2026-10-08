import {NextResponse} from "next/server";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {authorizeMorgan,MORGAN_NEGOCIO} from "@/lib/morgan-integration";
import {MORGAN_SOURCE} from "@/lib/morgan-source";
import {morganPayload,morganPaymentConfig,morganPreview,sendMorganText} from "@/lib/morgan-order-service";
export const runtime="nodejs";
export async function POST(req:Request){
 const denied=authorizeMorgan(req);if(denied)return denied;
 try{
 const input=z.object({accion:z.enum(["enviar","estado","reintentar","tasas","previsualizar","configuracion","configurar_pago","reintentar_lote"]),instrucciones:z.string().trim().max(3000).optional(),pedido:morganPayload.optional(),solicitud_id:z.string().uuid().optional()}).parse(await req.json()),sb=createAdminClient();
 if(input.accion==='configuracion'){const c=await morganPaymentConfig();return NextResponse.json({instrucciones:c.paymentInstructions,pago_configurado:c.methods.length>0})}
 if(input.accion==='configurar_pago'){const saved=await sb.from('negocios').update({morgan_pago_instrucciones:input.instrucciones||null}).eq('id',MORGAN_NEGOCIO);if(saved.error)throw Error('No se pudieron guardar los datos de pago');const c=await morganPaymentConfig();return NextResponse.json({ok:true,pago_configurado:c.methods.length>0})}
 if(input.accion==='reintentar_lote'){const rows=await sb.from(MORGAN_SOURCE.table).select('morgan_solicitud_id').eq('negocio_id',MORGAN_NEGOCIO).not('morgan_solicitud_id','is',null).is('morgan_whatsapp_enviado_en',null).is('morgan_pago_aprobado_at',null).neq(MORGAN_SOURCE.travel?'estado_pago':'estado',MORGAN_SOURCE.travel?'PAGADO':'cancelado').order(MORGAN_SOURCE.createdColumn).limit(5);if(rows.error)throw Error('No se pudieron leer los pendientes');let enviados=0;for(const row of rows.data||[]){const r=await POST(new Request(req.url,{method:'POST',headers:{Authorization:req.headers.get('authorization')||'','Content-Type':'application/json'},body:JSON.stringify({accion:'reintentar',solicitud_id:row.morgan_solicitud_id})}));if(r.ok&&(await r.json()).whatsapp_enviado)enviados++}return NextResponse.json({procesados:rows.data?.length||0,enviados})}
 if(input.accion==="tasas"){const cfg=await morganPaymentConfig();return NextResponse.json({bcv_usd:cfg.rate,bcv_eur:null,binance:(await sb.from("negocios").select("tasa_binance").eq("id",MORGAN_NEGOCIO).single()).data?.tasa_binance??null,actualizada_en:null})}
 if(input.accion==="previsualizar"){if(!input.pedido)return NextResponse.json({error:"Falta pedido"},{status:422});return NextResponse.json({...await morganPreview(input.pedido),vista_previa:true})}
 let id:string;
 if(input.accion==="enviar"){
  if(!input.pedido)return NextResponse.json({error:"Falta pedido"},{status:422});
  const {data,error}=await sb.rpc("morgan_importar_pedido",{p_datos:input.pedido});if(error)return NextResponse.json({error:error.message.includes("CONFIGURA_TASA")?"Configura una tasa válida en Morgan antes de enviar.":"No se pudo importar: revisa los artículos y la cotización fijada."},{status:409});id=data;
 }else{
  if(!input.solicitud_id)return NextResponse.json({error:"Falta solicitud"},{status:422});
  const {data,error}=await sb.from(MORGAN_SOURCE.table).select("id").eq("negocio_id",MORGAN_NEGOCIO).eq("morgan_solicitud_id",input.solicitud_id).maybeSingle();if(error||!data)return NextResponse.json({error:"Pedido no encontrado"},{status:404});id=data.id;
 }
 const {data:p,error}=await sb.from(MORGAN_SOURCE.table).select("id,morgan_cotizacion,morgan_total_centavos,morgan_total_bs,morgan_pago_aprobado_at,morgan_whatsapp_enviado_en,"+(MORGAN_SOURCE.travel?"estado_pago":"estado")).eq("id",id).eq("negocio_id",MORGAN_NEGOCIO).single();if(error||!p)return NextResponse.json({error:"No se pudo leer el pedido"},{status:503});
 const row=p as unknown as Record<string,unknown>,q=morganPayload.parse(row.morgan_cotizacion);let enviado=!!row.morgan_whatsapp_enviado_en,aviso="Pedido guardado en la PWA del comercio.";
 let message:string|undefined;let canManual=false;
 if(input.accion!=="estado"&&!enviado&&!row.morgan_pago_aprobado_at&&row.estado!=="cancelado"){
  const preview=await morganPreview(q,{id:String(row.id),morgan_total_centavos:Number(row.morgan_total_centavos),morgan_total_bs:Number(row.morgan_total_bs)});message=preview.mensaje;canManual=preview.paymentConfigured;
  if(preview.paymentConfigured){const {data:reserved,error}=await sb.rpc("morgan_reservar_envio",{p_id:id});if(error)throw Error("No se pudo reservar el envío");if(reserved){const sent=await sendMorganText(q.telefono,message);enviado=sent.ok;if(enviado){const {error}=await sb.from(MORGAN_SOURCE.table).update({morgan_whatsapp_enviado_en:new Date().toISOString()}).eq("id",id).eq("negocio_id",MORGAN_NEGOCIO);if(error)throw Error("Mensaje enviado, pero no se pudo registrar. Revisa antes de reintentar.");}else aviso="Pedido guardado. WhatsApp no está disponible; puedes abrir el mensaje preparado y enviarlo desde tu cuenta.";}}
  else aviso="Pedido guardado. Configura los datos de pago en la PWA, sección /morgan, antes de enviarlo.";
 }
 return NextResponse.json({pedido_id:id,estado:row.estado==="cancelado"?"cancelado":row.morgan_pago_aprobado_at?"pagado":"esperando_pago",pagado:!!row.morgan_pago_aprobado_at,whatsapp_enviado:enviado,total_usd:Number(row.morgan_total_centavos)/100,total_bs:Number(row.morgan_total_bs),tipo_entrega:q.tipo_entrega,aviso:enviado?"Total y datos de pago enviados.":aviso,...(message?{mensaje:message,...(canManual?{whatsapp_url:"https://wa.me/"+q.telefono+"?text="+encodeURIComponent(message)}:{})}:{})},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?"Datos inválidos":e instanceof Error?e.message:"No se pudo procesar"},{status:e instanceof z.ZodError?422:409})}
}
