"""Explicit tool demonstrations authored for local acceptance, never AI responses."""
def table_plan():
    ops=[]
    def make(id,name,shape,size,position,color,bevel=.008,rotation=None):
        item={'op':'create','id':id,'name':name,'shape':shape,'size':size,'position':position,'color':color}
        if rotation:item['rotation']=rotation
        ops.append(item)
        if bevel:ops.append({'op':'bevel','id':id,'width':bevel,'segments':5})
    make('top','胡桃木桌面','box',[1.6,.06,.78],[0,.76,0],'#91623e',.018)
    for i,(x,z) in enumerate(((-.66,-.27),(.66,-.27),(-.66,.27),(.66,.27))):
        make('leg-'+str(i),'金属桌腿 '+str(i+1),'cylinder',[.065,.72,.065],[x,.36,z],'#303c49',.008)
        ops.append({'op':'smooth','id':'leg-'+str(i)})
        make('foot-'+str(i),'黄铜脚套 '+str(i+1),'cylinder',[.073,.065,.073],[x,.0325,z],'#b88d47',.004)
        ops.append({'op':'material','id':'foot-'+str(i),'color':'#b88d47','metallic':.8,'roughness':.28})
    for i,x in enumerate((-.37,.37)):
        body='drawer-case-'+str(i);cut='drawer-cut-'+str(i)
        make(body,'抽屉外壳 '+str(i+1),'box',[.68,.19,.62],[x,.635,0],'#68462e',0)
        make(cut,'抽屉开口切割体','box',[.62,.15,.74],[x,.645,.08],'#ffffff',0)
        ops.append({'op':'boolean','id':body,'toolId':cut,'operation':'DIFFERENCE'})
        ops.append({'op':'bevel','id':body,'width':.006,'segments':3})
        make('drawer-front-'+str(i),'抽屉面板 '+str(i+1),'box',[.635,.145,.025],[x,.63,.325],'#a9784c',.008)
        make('handle-'+str(i),'黄铜把手 '+str(i+1),'cylinder',[.018,.16,.018],[x,.63,.36],'#c99f56',.004,[0,0,90])
        ops.append({'op':'material','id':'handle-'+str(i),'color':'#c99f56','metallic':.8,'roughness':.25})
    return {'name':'胡桃木双抽屉书桌 · 初版','operations':ops}


def refine_table_plan():
    ops=[{'op':'bevel','id':'top','width':.028,'segments':8}]
    for i in range(4):
        ops.append({'op':'update','id':'leg-'+str(i),'size':[.095,.72,.095]})
        ops.append({'op':'update','id':'foot-'+str(i),'size':[.103,.065,.103]})
    return {'name':'胡桃木双抽屉书桌 · 加粗桌腿与圆角','operations':ops}
