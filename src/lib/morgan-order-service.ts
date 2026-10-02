import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {MORGAN_NEGOCIO} from "./morgan-integration";
import {MORGAN_SOURCE} from "./morgan-source";
import {morganOrderMessage} from "./morgan-message";

export const morganPayload=z.object({solicitud_id:z.string().uuid(),telefono:z.string().regex(/^58[0-9]{10}$/),nombre:z.string().min(2).max(100),detalle:z.string().max(2000),notas:z.string().max(1500).optional(),ajuste_centavos:z.number().int().min(-100000000).max(100000000).optional(),cambio:z.object({fuente:z.enum(["bcv_usd","bcv_eur","binance"]),tasa:z.number().positive().max(1000000),fijada_en:z.string().datetime()}).optional(),no_disponibles:z.array(z.object({nombre:z.string().min(1).max(160),cantidad:z.number().int().min(1).max(100),nota:z.string().max(300).optional()})).max(30).optional(),tipo_entrega:z.enum(["delivery","retiro"]),direccion:z.string().max(300),lat:z.number().min(-90).max(90).nullable(),lng:z.number().min(-180).max(180).nullable(),distancia_km:z.number().nonnegative().nullable(),delivery_centavos:z.number().int().min(0).max(100000000),items:z.array(z.object({plato_id:z.string().uuid().nullable(),nombre:z.string().min(1).max(160),cantidad:z.number().int().min(1).max(100),precio_centavos:z.number().int().min(0).max(100000000),nota:z.string().max(300).optional()})).min(1).max(30)});
export async function morganPaymentConfig(){
 const sb=createAdminClient();
 const {data:b,error}=await sb.from("negocios").select("nombre,morgan_pago_instrucciones"+(MORGAN_SOURCE.rateColumn?","+MORGAN_SOURCE.rateColumn:"")+(MORGAN_SOURCE.hasBusinessPayments?",metodos_pago":"")).eq("id",MORGAN_NEGOCIO).single();if(error)throw Error("No se pudo consultar la configuración");
 const business=b as unknown as Record<string,unknown>;
 let methods:{tipo:string;datos:string}[]=[];
 if(MORGAN_SOURCE.hasPaymentTable){const {data,error}=await sb.from("metodos_pago").select("tipo,datos").eq("negocio_id",MORGAN_NEGOCIO).eq("activo",true);if(error)throw Error("No se pudieron leer métodos de pago");methods=data||[];}
 if(MORGAN_SOURCE.hasBusinessPayments&&Array.isArray(business.metodos_pago))methods=business.metodos_pago.filter(m=>m&&typeof m.datos==="string"&&m.datos.trim()).map(m=>({tipo:m.label||m.tipo||"Pago",datos:m.datos}));
 if(typeof business.morgan_pago_instrucciones==="string"&&business.morgan_pago_instrucciones.trim())methods=[{tipo:"Indicaciones del comercio",datos:business.morgan_pago_instrucciones}];
 return {brand:"Ferretería Joel",rate:MORGAN_SOURCE.rateColumn?Number(business[MORGAN_SOURCE.rateColumn])||null:null,methods,paymentInstructions:typeof business.morgan_pago_instrucciones==="string"?business.morgan_pago_instrucciones:""};
}
export async function sendMorganText(phone:string,text:string){return {ok:false,motivo:"whatsapp_no_configurado"};}
export async function morganPreview(q:z.infer<typeof morganPayload>,stored?:{id:string;morgan_total_centavos:number;morgan_total_bs:number}){
 const cfg=await morganPaymentConfig(),cents=stored?.morgan_total_centavos??(q.items.reduce((a,i)=>a+i.cantidad*i.precio_centavos,0)+q.delivery_centavos+(q.ajuste_centavos||0)),rate=q.cambio?.tasa??cfg.rate;
 if(!rate||cents<0||cents>100000000)throw Error("Configura una tasa válida en el panel Morgan antes de confirmar.");
 const usd=cents/100,bs=stored?.morgan_total_bs??Math.round(cents*rate)/100;
 const methods=cfg.methods.length?cfg.methods:[{tipo:"Pago",datos:"El comercio debe indicar los datos de pago antes de enviar el total."}];
 return {mensaje:morganOrderMessage(cfg.brand,stored?.id||q.solicitud_id,q,usd,bs,methods),total_usd:usd,total_bs:bs,paymentConfigured:cfg.methods.length>0};
}
