import {NextResponse} from "next/server";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {authorizeMorgan} from "@/lib/morgan-integration";
export const runtime="nodejs";
const schema=z.object({consulta:z.string().max(200).default(""),ids:z.array(z.string().uuid()).max(30).optional(),offset:z.number().int().min(0).max(100000).default(0),limite:z.number().int().min(1).max(150).default(20)});
export async function POST(req:Request){
 const denied=authorizeMorgan(req);if(denied)return denied;
 let input;try{input=schema.parse(await req.json())}catch{return NextResponse.json({error:"Consulta inválida"},{status:422})}
 const sb=createAdminClient();const {data,error}=await sb.rpc("morgan_catalogo",{p_consulta:input.consulta,p_ids:input.ids||null,p_offset:input.offset,p_limite:input.limite});
 if(error)return NextResponse.json({error:"No se pudo consultar el catálogo del comercio"},{status:503});
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}
