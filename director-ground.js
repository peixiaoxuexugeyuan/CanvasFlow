/* Ground coordinates belong to the scene root, independently of actor/group transforms. */
(function(root){
  'use strict';
  function bounds(T,mesh,planeRoot){
    // updateMatrixWorld also refreshes SkinnedMesh's attached bind inverse after placement changes.
    planeRoot.updateWorldMatrix(true,false);planeRoot.updateMatrixWorld(true);mesh.updateMatrixWorld(true);
    const box=new T.Box3().makeEmpty(),inverse=planeRoot.matrixWorld.clone().invert(),matrix=new T.Matrix4(),point=new T.Vector3();
    mesh.traverse(child=>{
      if(!child.isMesh||child.userData.directorHelper||!child.geometry?.attributes.position)return;
      if(child.isSkinnedMesh)child.skeleton.update();
      matrix.copy(inverse).multiply(child.matrixWorld);
      for(let i=0;i<child.geometry.attributes.position.count;i++){child.getVertexPosition(i,point);box.expandByPoint(point.applyMatrix4(matrix));}
    });
    return box;
  }
  function localDisplacement(T,planeRoot,parent,heightDelta){
    planeRoot.updateWorldMatrix(true,false);parent.updateWorldMatrix(true,false);
    const matrix=parent.matrixWorld.clone().invert().multiply(planeRoot.matrixWorld),origin=new T.Vector3().applyMatrix4(matrix);
    return new T.Vector3(0,heightDelta,0).applyMatrix4(matrix).sub(origin).toArray();
  }
  function translateMotion(object,track,delta){
    object.transform.position=object.transform.position.map((value,i)=>value+delta[i]);
    if(!track)return;
    for(let i=0;i<3;i++)for(const key of track.channels?.['position.'+'xyz'[i]]||[])key.value+=delta[i];
    const paths=new Set([track.path,...(track.agentPaths||[]).map(stage=>stage.path)]);
    for(const path of paths)if(path?.origin)path.origin=path.origin.map((value,i)=>value+delta[i]);
  }
  const api={bounds,localDisplacement,translateMotion};
  if(typeof module==='object'&&module.exports)module.exports=api;root.DirectorGround=api;
})(typeof window==='object'?window:globalThis);
