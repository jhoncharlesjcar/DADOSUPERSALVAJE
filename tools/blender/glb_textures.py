"""Coalesce identical glTF texture descriptors; keep images, geometry and animation binary unchanged."""
import json, struct
from pathlib import Path

def deduplicate_textures(path):
 path=Path(path);raw=path.read_bytes()
 if raw[:4]!=b'glTF':raise ValueError('Expected GLB')
 size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size])
 textures=[];indices={};mapping={}
 for i,texture in enumerate(doc.get('textures',[])):
  signature=json.dumps(texture,sort_keys=True)
  if signature not in indices:indices[signature]=len(textures);textures.append(texture)
  mapping[i]=indices[signature]
 def visit(value):
  if isinstance(value,dict):
   for key,child in value.items():
    if key.endswith('Texture') and isinstance(child,dict) and 'index' in child:child['index']=mapping[child['index']]
    else:visit(child)
  elif isinstance(value,list):
   for child in value:visit(child)
 visit(doc.get('materials',[]));doc['textures']=textures
 encoded=json.dumps(doc,separators=(',',':')).encode('utf8');encoded+=b' '*((-len(encoded))%4)
 rest=raw[20+size:]
 path.write_bytes(b'glTF'+struct.pack('<IIII',2,20+len(encoded)+len(rest),len(encoded),0x4e4f534a)+encoded+rest)
 print('GLB_TEXTURES',len(mapping),'->',len(textures),flush=True)

if __name__=='__main__':
 import sys
 deduplicate_textures(sys.argv[sys.argv.index('--')+1])
