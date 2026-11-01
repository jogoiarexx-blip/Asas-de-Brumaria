"""Runs under blender -b source.blend --python this-script -- exported.glb
Only exports model and animation from the authorized CC0 source.
"""
import bpy, sys, json, os
from pathlib import Path

def main():
    try:
        sep=sys.argv.index("--")
        target=Path(sys.argv[sep+1]).resolve()
    except (ValueError,IndexError):
        raise SystemExit("Usage: blender -b cethiel-source.blend --python tools/export_cc0_dragon_blender.py -- out.glb")
    target.parent.mkdir(parents=True,exist_ok=True)
    meshes=[x for x in bpy.data.objects if x.type=="MESH"]
    armatures=[x for x in bpy.data.objects if x.type=="ARMATURE"]
    actions=list(bpy.data.actions)
    print("DRAGON_SOURCE "+json.dumps({"blender":bpy.app.version_string,
      "mesh_count":len(meshes),"armatures":[o.name for o in armatures],
      "actions":[a.name for a in actions],"mesh_names":[x.name for x in meshes]}),flush=True)
    if not meshes:raise RuntimeError("The source .blend has no mesh")
    for obj in bpy.data.objects:
        if obj.type in ("MESH","ARMATURE"):
            obj.hide_viewport=False
            obj.hide_render=False
    scene=bpy.context.scene
    # Export whole scene (including skinned mesh and its bones).
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type in ("MESH","ARMATURE","EMPTY"):
            obj.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active=meshes[0]
    # The CC0 original has Walk/Idle/Attack/Die, but no flying animation.
    # Derive two original wing-flap clips using the existing armature. Keep
    # the source actions untouched, copy idle body/head motion into each clip.
    if armatures:
        import math
        from mathutils import Quaternion
        rig=armatures[0]
        wing_names=("wing_upper.L","wing_lower.L","wing_upper.R","wing_lower.R")
        if all(rig.pose.bones.get(name) for name in wing_names):
            idle=bpy.data.actions.get("Idle")
            if idle:
                rig.animation_data_create()
                for clip,amplitude in (("Flying",.62),("Glide",.10)):
                    action=idle.copy()
                    action.name=clip
                    # Blender 5 removed Action.fcurves. Curves now live in
                    # per-slot channelbags; preserve other body/head tracks.
                    if bpy.app.version >= (4, 4, 0):
                        for layer in action.layers:
                            for strip in layer.strips:
                                if strip.type != "KEYFRAME":
                                    continue
                                for slot in action.slots:
                                    bag=strip.channelbag(slot)
                                    if bag is None:
                                        continue
                                    for fcurve in list(bag.fcurves):
                                        if any('pose.bones["'+name+'"]' in fcurve.data_path
                                               for name in wing_names):
                                            bag.fcurves.remove(fcurve)
                    else:
                        for fcurve in list(action.fcurves):
                            if any('pose.bones["'+name+'"]' in fcurve.data_path
                                   for name in wing_names):
                                action.fcurves.remove(fcurve)
                    rig.animation_data.action=action
                    if bpy.app.version >= (4, 4, 0) and action.slots:
                        # Explicitly bind the slot; in Blender 5 a copied
                        # Action's slot need not auto-bind to the Armature.
                        rig.animation_data.action_slot=action.slots[0]
                    for frame in (1,7,13,19,25):
                        phase=(frame-1)/24*math.pi*2
                        for name in wing_names:
                            bone=rig.pose.bones[name]
                            side=1 if name.endswith(".L") else -1
                            extension=.38 if "lower" in name else 1.0
                            angle=math.sin(phase)*amplitude*side*extension
                            bone.rotation_mode="QUATERNION"
                            bone.rotation_quaternion=Quaternion((0,0,1),angle)
                            bone.keyframe_insert(data_path="rotation_quaternion",frame=frame)
                    action.use_fake_user=True
                    curve_count=sum(
                        len(strip.channelbag(slot).fcurves)
                        for layer in action.layers for strip in layer.strips
                        if strip.type=="KEYFRAME"
                        for slot in action.slots if strip.channelbag(slot) is not None
                    ) if bpy.app.version >= (4,4,0) else len(action.fcurves)
                    print("DRAGON_SYNTHETIC_CLIP",clip,curve_count,flush=True)
                rig.animation_data.action=idle
        else:
            print("DRAGON_SYNTHETIC_CLIP_SKIPPED missing wing bones",flush=True)
    available=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs={"filepath":str(target),"export_format":"GLB","use_selection":True,
            "export_animations":True}
    if "export_animation_mode" in available:
        kwargs["export_animation_mode"]="ACTIONS"
    elif "export_nla_strips" in available:
        kwargs["export_nla_strips"]=True
    if "export_force_sampling" in available:kwargs["export_force_sampling"]=True
    if "export_apply" in available:kwargs["export_apply"]=False
    bpy.ops.export_scene.gltf(**kwargs)
    if not target.is_file() or target.stat().st_size<1000:
        raise RuntimeError("Blender GLB exporter produced no useful model")
    print("DRAGON_EXPORT "+json.dumps({"path":str(target),
      "bytes":target.stat().st_size,"actions_source":[a.name for a in actions]}),flush=True)

if __name__=="__main__":main()
