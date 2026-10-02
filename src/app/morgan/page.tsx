import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {MORGAN_NEGOCIO} from "@/lib/morgan-integration";
import {MORGAN_SOURCE} from "@/lib/morgan-source";
import {MorganOrders} from "@/components/morgan-orders";
export default async function MorganPage(){const sb=await createClient(),{data:{user}}=await sb.auth.getUser();if(!user)redirect("/login");const {data}=await sb.from(MORGAN_SOURCE.members).select("id").eq("id",user.id).eq("negocio_id",MORGAN_NEGOCIO).eq("rol","ADMIN").maybeSingle();if(!data)return <main className="p-6">Esta sección requiere el administrador de este comercio.</main>;return <MorganOrders/>}
