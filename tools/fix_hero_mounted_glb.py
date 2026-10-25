#!/usr/bin/env python3
"""Rebake the 10 mounted rotations in the published 44-bone GLB in place.
All mesh, textures, original 5 authored animations, and GLB layout are kept.
No third-party Python dependencies are required.
"""
import json, math, os, struct, sys
from pathlib import Path
BONES={
 'hips':'mixamorig:Hips','spine':'mixamorig:Spine','spine1':'mixamorig:Spine1',
 'chest':'mixamorig:Spine2','neck':'mixamorig:Neck','head':'mixamorig:Head',
 'lthigh':'mixamorig:LeftUpLeg','rthigh':'mixamorig:RightUpLeg',
 'lknee':'mixamorig:LeftLeg','rknee':'mixamorig:RightLeg',
 'lfoot':'mixamorig:LeftFoot','rfoot':'mixamorig:RightFoot',
 'larm':'mixamorig:LeftArm','rarm':'mixamorig:RightArm',
 'lelbow':'mixamorig:LeftForeArm','relbow':'mixamorig:RightForeArm',
 'lhand':'mixamorig:LeftHand','rhand':'mixamorig:RightHand'}
def mul(a,b):
 x,y,z,w=a;X,Y,Z,W=b
 return (w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def rot(x,y,z):
 a,b,c=[math.radians(t)/2 for t in (x,y,z)]
 return mul(mul((math.sin(a),0,0,math.cos(a)),(0,math.sin(b),0,math.cos(b))),(0,0,math.sin(c),math.cos(c)))
def seated(t,strength=1):
 w=math.sin(2*math.pi*t)
 p=dict(hips=[6,0,.9*w],spine=[7,0,-.6*w],spine1=[6,0,.5*w],
  chest=[5,0,-.8*w],neck=[-2,0,0],head=[0,1.2*w,0],
  lthigh=[-63,0,-7],rthigh=[-63,0,7],lknee=[82,0,0],rknee=[82,0,0],
  lfoot=[-14,0,0],rfoot=[-14,0,0],larm=[57,21,-10],rarm=[60,-19,7],
  lelbow=[41,3,-3],relbow=[38,-3,4],lhand=[-8,0,0],rhand=[-8,0,0])
 return {k:[v*strength for v in angles] for k,angles in p.items()}
def flying(t,flapping=True):
 p=seated(t);w=math.sin(2*math.pi*t)
 p.update(chest=[5+(2*w if flapping else 0),0,-1.2*w],spine1=[7,0,-.8*w],
  hips=[7,0,.9*w],head=[-2,0,-1.8*w],
  larm=[57+(3*w if flapping else 0),21,-10],
  rarm=[60+(3*w if flapping else 0),-19,7],
  lelbow=[41+1.5*w,3,-3],relbow=[38+1.5*w,-3,4])
 return p
def pose(name,t):
 w=math.sin(2*math.pi*t)
 if name=='Mount':return seated(t,min(1,max(0,t*1.28)))
 if name=='Dismount':return seated(t,min(1,max(0,(1-t)*1.28)))
 if name=='Riding_Idle':return seated(t)
 if name=='Riding_Walk':
  p=seated(t);p.update(chest=[5,0,1.1*w],hips=[6,0,-1.1*w],
   lthigh=[-63+3*w,0,-7],rthigh=[-63-3*w,0,7]);return p
 if name=='Riding_Fly':return flying(t)
 if name=='Riding_Glide':return flying(t,False)
 if name=='Riding_Takeoff':
  p=flying(t);p.update(chest=[11-6*t,0,0],hips=[9-2*t,0,0]);return p
 if name=='Riding_Landing':
  p=seated(t);p.update(chest=[9-4*t,0,0],hips=[9-3*t,0,0]);return p
 if name=='Riding_Attack':
  p=flying(t,False);p.update(rarm=[60+10*math.sin(math.pi*t),-19,7],
   chest=[5+7*math.sin(math.pi*t),0,0]);return p
 if name=='Riding_Hurt':
  p=seated(t);p.update(spine=[7,0,9*math.sin(math.pi*t)],
   head=[0,0,-12*math.sin(math.pi*t)]);return p
 return None
def correct(raw):
 if len(raw)<20:raise ValueError('GLB truncated')
 magic,ver,size=struct.unpack_from('<4sII',raw)
 if magic!=b'glTF' or ver!=2 or size!=len(raw):raise ValueError('Invalid GLB header')
 jlen,jtype=struct.unpack_from('<I4s',raw,12)
 if jtype!=b'JSON':raise ValueError('Missing JSON')
 doc=json.loads(raw[20:20+jlen]);bin_start=20+jlen+8
 nodes=doc['nodes'];aliases={node['name']:alias for alias,name in BONES.items()
  for node in nodes if node.get('name')==name}
 if len(aliases)<15:raise ValueError('Not a supported Mixamo rig')
 data=bytearray(raw);updated={}
 def region(idx):
  a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']]
  if a['componentType']!=5126:raise ValueError('Accessor must use float')
  dims={'VEC4':4,'VEC3':3,'SCALAR':1}[a['type']]
  return (bin_start+v.get('byteOffset',0)+a.get('byteOffset',0),
   v.get('byteStride',dims*4),a['count'],dims)
 for a in doc['animations']:
  if pose(a.get('name',''),0) is None:continue
  name=a['name'];count=0
  for ch in a['channels']:
   node=nodes[ch['target']['node']];alias=aliases.get(node.get('name'))
   if not alias or ch['target']['path']!='rotation':continue
   sample=a['samplers'][ch['sampler']]
   o=region(sample['output']);inp=region(sample['input'])
   if o[3]!=4 or inp[3]!=1 or o[2]!=inp[2]:raise ValueError('Unexpected animation layout')
   original=node.get('rotation',[0,0,0,1]);off,step,n,_=o;io,istep,_,_=inp
   duration=struct.unpack_from('<f',raw,io+(n-1)*istep)[0]
   last=None
   for i in range(n):
    tick=struct.unpack_from('<f',raw,io+i*istep)[0]
    t=tick/duration if duration>0 else 0
    delta=pose(name,t).get(alias,[0,0,0]);q=mul(original,rot(*delta))
    norm=math.sqrt(sum(v*v for v in q));q=tuple(v/norm for v in q)
    if last is not None and sum(v*w for v,w in zip(last,q))<0:q=tuple(-v for v in q)
    struct.pack_into('<4f',data,off+i*step,*q);last=q
   count+=1
  updated[name]=count
 if len(updated)!=10 or any(n<14 for n in updated.values()):
  raise ValueError('10 mounted clips not verified: '+str(updated))
 return bytes(data),updated
if __name__=='__main__':
 p=Path(sys.argv[1] if len(sys.argv)>1 else 'assets/models/personagem_animado_montaria.glb')
 new,updated=correct(p.read_bytes());tmp=p.with_suffix('.tmp')
 tmp.write_bytes(new);os.replace(tmp,p)
 print('Ten mounted animations corrected; original five clips retained:',updated)
