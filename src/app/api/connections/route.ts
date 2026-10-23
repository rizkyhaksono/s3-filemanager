import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { createConnection, listConnections, parseConnectionInput } from "@/lib/connections";

export const GET = route(async () => NextResponse.json(listConnections()));

export const POST = route(async (req) => {
  const input = parseConnectionInput(await readJson(req), true);
  return NextResponse.json(createConnection(input), { status: 201 });
});
