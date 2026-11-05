import { expect, it } from "vitest";
import { base64, exportSvg, fontFaceCss, exportFamily, createBundle, parseBundle, rasterSize, MissingResourcesError } from "@/lib/design/export";
import { blankDoc, DesignDocSchema } from "@/lib/design/schema";
import { approxMeasure } from "@/lib/design/layout";
import { OWN_LICENCE } from "@/lib/design/library";
import type { Resource } from "@/lib/design/resource";
const font = Uint8Array.of(0,1,0,0);
const doc = DesignDocSchema.parse({ ...blankDoc("doc", "Test", 1080,1350,1), layers: [ { id:"text", name:"Title", type:"text", x:0,y:0,w:1000,h:200,text:"Hà Nội",font:"lora",size:50,color:"#202323" }, { id:"custom", name:"Custom", type:"text", x:0,y:300,w:1000,h:200,text:"Đêm",font:"res_font",size:50,color:"#202323" } ] });
const resource: Resource = { id:"res_font",kind:"font",name:"Font",mime:"font/ttf",bytes:4,licence:OWN_LICENCE,tags:[],createdAt:1,updatedAt:1,blob:new Blob([font]) };
it("encodes base64 without Node globals", () => { expect(base64(Uint8Array.of(0,1,2,253,254))).toBe("AAEC/f4="); expect(base64(new Uint8Array())).toBe(""); });
it("embeds only used font faces and image data URLs", async () => {
  const loaded: string[] = [];
  const imageDoc = DesignDocSchema.parse({ ...doc, layers:[...doc.layers,{id:"image",name:"Image",type:"image",x:0,y:600,w:100,h:100,resourceId:"res_image"}] });
  const svg = await exportSvg(imageDoc, {measure:approxMeasure,loadBuiltinFont:async (f) => {loaded.push(f);return font;},loadResource:async (id) => ({mime:id === "res_image" ? "image/png" : "font/ttf",bytes:font})});
  expect(loaded).toEqual(["Lora-Variable.ttf"]); expect(svg).toContain('data:image/png;base64,'); expect(svg).toContain('data:font/ttf;base64,'); expect(svg).not.toContain("blob:"); expect(svg).not.toContain("FP anton"); expect(svg).not.toContain("placeholder");
  expect(fontFaceCss([{family:exportFamily("lora"),weight:"400",style:"normal",mime:"font/ttf",bytes:font}])).toContain('font-family:"FP lora"');
});
it("lists missing resource ids", async () => {
  try { await exportSvg(doc,{measure:approxMeasure,loadBuiltinFont:async()=>font,loadResource:async()=>null}); throw new Error("Expected failure"); } catch(e) { expect(e).toBeInstanceOf(MissingResourcesError); expect((e as MissingResourcesError).ids).toEqual(["res_font"]); }
});
it("round trips document and resource bytes", async () => { const result = parseBundle(await createBundle(doc,[resource])); expect(result.doc).toEqual(doc); expect(result.resources[0]!.bytes).toEqual(font); });
it("rejects malformed bundle metadata, missing resources and mismatched bytes", async () => {
  const original = JSON.parse(await createBundle(doc,[resource]));
  const mutations = [ {format:"other"}, {version:2}, {resources:[]}, {resources:[{...original.resources[0],data:"AAAAAA=="}]}, {resources:[{...original.resources[0],bytes:5}]}, {resources:[{...original.resources[0],data:"!!!!"}]}, {resources:[{...original.resources[0],kind:"image"}]}, {resources:[original.resources[0],original.resources[0]]} ];
  mutations.forEach((m)=>expect(()=>parseBundle(JSON.stringify({...original,...m}))).toThrow());
  expect(()=>parseBundle(" ".repeat(60*1024*1024+1))).toThrow("60 MB");
});
it("rejects creation with missing resources", async()=>{await expect(createBundle(doc,[])).rejects.toBeInstanceOf(MissingResourcesError);});
it.each([[1080,1350,1],[6000,6000,10],[100,6000,100],[6000,100,100]])("caps raster size for %s × %s at %s", (w,h,s)=>{const size=rasterSize(w,h,s);expect(Math.max(size.width,size.height)).toBeLessThanOrEqual(8192);expect(size.width*size.height).toBeLessThanOrEqual(40_000_000);expect(size.width/size.height).toBeCloseTo(w/h,0);});
it.each([0,-1,Infinity,NaN])("rejects invalid raster dimensions %s", (n)=>expect(()=>rasterSize(100,100,n)).toThrow());
it("round trips an image bundle and rejects forged image headers and dimensions", async () => {
  const png = Uint8Array.of(137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1);
  const imageDoc = DesignDocSchema.parse({...blankDoc("image-doc","Image",1080,1350,1),layers:[{id:"image",name:"Photo",type:"image",x:0,y:0,w:100,h:100,resourceId:"res_image"}]});
  const r: Resource = {...resource,id:"res_image",kind:"image",mime:"image/png",bytes:png.length,width:1,height:1,blob:new Blob([png])};
  const text = await createBundle(imageDoc,[r]);
  expect(parseBundle(text).resources[0]!.bytes).toEqual(png);
  const b = JSON.parse(text);
  for (const change of [{mime:"image/jpeg"},{width:2},{data:base64(png.slice(0,8)),bytes:8}]) expect(()=>parseBundle(JSON.stringify({...b,resources:[{...b.resources[0],...change}]}))).toThrow();
});
it("round trips all byte values and base64 tail lengths", async () => {
  for (const length of [256,257,258]) {
    const bytes = Uint8Array.from({length},(_,i)=>i%256); bytes.set(font);
    const result = parseBundle(await createBundle(doc,[{...resource,bytes:length,blob:new Blob([bytes])}]));
    expect(result.resources[0]!.bytes).toEqual(bytes);
  }
});
