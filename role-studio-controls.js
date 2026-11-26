(() => {
  const range = (id, label, min = 0, max = 100, initial = 0, step = 1) =>
    ({ id, label, type: 'range', min, max, step, default: initial });
  const adjust = (id, label) => range(id, label, -100, 100);
  const generationOnly = (field) => ({ ...field, generationOnly:true, hint: '该调整不支持预览，需要生成后生效' });
  const choice = (id, label, options, initial = options[0]) =>
    ({ id, label, type: 'choice', options, default: initial });
  const description = (id, label, placeholder) =>
    ({ id, label, type: 'text', placeholder, default: '' });
  const tab = (id, label, fields) => ({ id, label, fields });

  const cards = (id, label, options) => ({ ...choice(id, label, options, ''), display: 'cards' });
  const swatches = (id, label, colors, customColor = false) => ({
    ...choice(id, label, Object.keys(colors), ''), display: 'swatches', colors, customColor,
  });

  const paired = (id, label, dash = false) => [
    adjust(id + 'Left', label + (dash ? '-左' : '（左）')),
    adjust(id + 'Right', label + (dash ? '-右' : '（右）')),
  ];
  const faceMakeup = [
    { id: 'browsPreset', label: '眉毛', materials: [
      ['biaozhunmei', '自然'], ['yizimei', '直眉'], ['yingqimei', '英气'],
      ['wanyuemei', '弯月'], ['gaotiaomei', '高挑'], ['jianmei', '浓密'],
      ['yeshengmei', '小挑眉'], ['shuliumei', '野生'], ['hengliumei', '原生'],
      ['Mi0000yD1mozSrdF', '古典'], ['Mi0000hGArIjPKqE', '丝雾'], ['Mi0000OlZZZLg427', '棕雾'],
      ['Mi0000JJ4k5NOuI9', '毛绒'],
    ], colors: { 'BK01': '#000000', 'BR01': '#6c4218', 'LB01': '#896429', 'RB01': '#9c3a27' } },
    { id: 'contactsPreset', label: '美瞳', materials: [
      ['qiaokeli', '琥珀'], ['fugulv', '橄榄绿'], ['taojihui', '混血灰'],
      ['ganmeigui', '灰粉'], ['yanhuazi', '烟花紫'], ['xingyunzong', '摩卡棕'],
      ['Mi0000YPyxa4tVJZ', '亚麻灰'], ['Mi0000KkQwKms79a', '金星棕'], ['Mi0000ctJWSsKeyV', '黑瞳'],
      ['Mi0000j9sVvEjCkG', '黑边'], ['Mi0000ILJ0BFFgGP', '红宝石'], ['Mi0000fhqyr6fZyl', '深棕'],
      ['Mi0000jqGa1V9RB6', '金珀'],
    ] },
    { id: 'underEyePreset', label: '卧蚕', materials: [
      ['suyan', '素颜'], ['ziran', '自然'], ['eyesocketrichang', '妈生感'],
      ['keai', '可爱'], ['wugu', '无辜'], ['chengshu', '月牙'],
      ['xiachui', '减龄'], ['eyesocketliangpian', '亮片'],
    ] },
    { id: 'shadowPreset', label: '眼影', materials: [
      ['luoxing', '裸杏'], ['eyeshadow10', '自然'], ['diaoxi', '无辜眼'],
      ['eyeshadow09', '元气'], ['eyeshadow04', '泪痣'], ['eyeshadow07', '自然'],
      ['eyeshadow08', '猫眼'], ['eyeshadowliangpian', '闪片'], ['eyeshadow05', '派对'],
      ['tangguo', '糖果'], ['Mi0000leDxesU8HP', '大地色'], ['Mi0000OPcCwZT80P', '消肿'],
      ['Mi0000BF9UTcGbc0', '海棠'],
    ] },
    { id: 'lashPreset', label: '睫毛', materials: [
      ['eyelash02', '自然'], ['eyelash01', '纯欲'], ['eyelash05', '甜妹'],
      ['eyelash06', '翘睫'], ['eyelash10', '仙女'], ['eyelash09', '短睫'],
      ['eyelash14', '鱼尾'], ['eyelash15', '漫画'], ['xiajiemao1', '下睫'],
      ['xiajiemao', '倒置'], ['eyelash9', '上睫'], ['Mi0000uTbmphGMDE', '浓密'],
      ['Mi00002I63gwAXR7', '太阳花'], ['Mi0000XtPAVP8ZpR', '卷翘'],
    ] },
    { id: 'contourPreset', label: '修容', materials: [
      ['liti', '立体'], ['featurerichang', '自然'], ['Vlian', 'V脸'],
      ['qizhi', '气质'], ['jianling', '塑造'], ['tila', '欧美'],
      ['biying', '笔挺'], ['gutong', '古铜'], ['Mi0000I8IWqaqbuW', '混血'],
      ['Mi0000ohvx7mN2YS', '盒鼻'], ['Mi0000A93APmWflz', '短鼻'],
    ] },
    { id: 'blushPreset', label: '腮红', materials: [
      ['blush01', '元气'], ['blush02', '眼下'], ['blush03', '法式'],
      ['blush08', '氛围'], ['blush06', '高原'], ['blush05', '面颊'],
      ['Mi0000fKcDexSogs', '微醺'], ['Mi00002yMqzH8Xnl', '冻伤'], ['Mi0000hfMqZn8tkR', '晒伤'],
      ['Mi0000gm5FZvaQj8', '红润'], ['Mi00006vvZFZmT76', '桃粉'], ['Mi0000Mfob60M0MY', '减龄'],
    ], colors: { '001': '#ff74b2', '002': '#ffe362', '003': '#d2807a', '004': '#c68291', '005': '#ff866a' } },
    { id: 'lipPreset', label: '唇彩', materials: [
      ['Mi0000pkce3FzLJR', '珊瑚粉'], ['luozhuang', '裸粉'], ['shuimitao', '蜜桃'],
      ['yingtao', '樱桃'], ['jiaotang', '南瓜'], ['juziqishui', '亮橘'],
      ['zhenghong', '正红'], ['jinli', '西柚'], ['yimase', '浆果'],
      ['dousha', '豆沙粉'], ['meigui', '玫瑰'], ['huolongguo', '火龙果'],
      ['Mi0000deCm1woQrB', '果冻'], ['Mi0000n7E1vsCzpt', '裸棕'], ['Mi0000hIhG4pPK7J', '砖红'],
      ['Mi0000Wmi9Qqy20b', '车厘子'], ['Mi0000VuA5Y29FXd', '玫红'],
    ] },
    { id: 'accentPreset', label: '妆饰', materials: [
      ['eyeshadow06', '眼下钻石'], ['queban', '雀斑'], ['Mi0000FVHF7wqiNC', '度假雀斑'],
      ['Mi0000qxnSbjKxgb', '慵懒雀斑'], ['Mi0000SiOzeusi2U', '野生雀斑'], ['meishiqueban', '美式雀斑'],
    ] },
    { id: 'linerPreset', label: '眼线', materials: [
      ['Mi0000cUzfaAlQgx', '自然系'], ['Mi0000Kri3hozVzR', '深邃'], ['Mi0000m4pyNOR5wA', '甜酷'],
      ['Mi0000FpkyFTjEhY', '韩系'], ['Mi0000ArTobhIM9y', '狗狗眼'], ['Mi00008Pdys6ShW3', '古典'],
      ['Mi0000mJDm4VZSZL', '全包'], ['Mi0000U8yopkvAQl', '开口下至'], ['Mi0000iIK9XUBFUc', '淡颜'],
      ['Mi0000WbLdWUO8Mn', '上扬'], ['Mi0000lMRW4bMbyN', '刀锋'],
    ], colors: { '01': '#351c1a', '02': '#000000', '03': '#655040', '04': '#654217', '05': '#9d241c', '06': '#960365' } },
    { id: 'highlightPreset', label: '高光', materials: [
      ['Mi0000aShpCmphEy', '眼下提亮'], ['Mi0000d3Ti0TATej', '丰润'], ['Mi0000CPhRXt5RoB', '平整'],
      ['Mi00003bH6O8902g', '盈润'], ['Mi0000qgUP6NxdZ5', '丰盈'], ['Mi0000TMtJhiPr77', '笔挺'],
      ['Mi0000IwiReFuX9r', '透亮'], ['Mi00009a3Hwy6AyZ', '水光'], ['Mi0000KNKZad2mUr', '小灯泡'],
    ] },
  ];

  const eyeLights = [
    ['yangqi', '氧气'], ['qingche', '清澈'], ['shencai', '神采'],
    ['qiushui', '秋水'], ['lingdong', '灵动'], ['shuiguang', '水光'],
    ['jujiao', '聚焦'], ['touliang', '透亮'], ['xingguang', '星光'],
    ['tongtou', '通透'],
  ];

  function materialCards(id, label, directory, materials) {
    const labels = Object.fromEntries(materials);
    const images = Object.fromEntries(materials.map(([itemId]) => [itemId, 'assets/role-studio/' + directory + '/' + itemId + '.jpg']));
    return { ...cards(id, label, ['无', ...Object.keys(labels)]), default:'无', labels, images,
      displayLabel:directory==='makeup'?'妆造素材':label, previewNote:'本地试妆预览，最终效果以生成为准' };
  }

  const eyeLightFields = [
    ['lightAlpha', '眼神光程度', 100], ['lightSize', '眼神光缩放', 100],
    ['lightRotate', '眼神光旋转', 99], ['lightX', '眼神光水平位置', 100],
    ['lightY', '眼神光垂直位置', 100], ['lightFlip', '眼神光水平翻转', 1],
  ].flatMap(([key, label, max]) => [['Left', '左'], ['Right', '右']].map(([side, text]) => {
    const id = key + side, title = label + '（' + text + '）';
    const field = key === 'lightFlip'
      ? { id, label: title, type: 'switch', default: false }
      : range(id, title, 0, max);
    if (key === 'lightAlpha') field.read = controls => {
      const left = controls?.['face.eyes.lightAlphaLeft'], right = controls?.['face.eyes.lightAlphaRight'];
      if (left == null && right == null && controls?.['face.eyes.eyeLight'] && controls['face.eyes.eyeLight'] !== '无') return 50;
      return (side === 'Left' ? left : right) ?? field.default;
    };
    return { ...field, activeWhen: { id: 'eyeLight', not: '无' } };
  }));

  const makeupFields = faceMakeup.flatMap(({ id, label, materials, colors }) => {
    const visibleWhen = { id: 'makeupCategory', value: label };
    const activeWhen = { id, not: '无' };
    const fields = [{ ...materialCards(id, label, 'makeup', materials), visibleWhen }];
    if (colors) fields.push({ ...swatches(id + 'Color', '颜色', colors), default: Object.keys(colors)[0], visibleWhen, activeWhen });
    fields.push({ ...range(id + 'Strength', '妆容强度', 0, 100, 50), visibleWhen, activeWhen });
    return fields;
  });

  const stylingCatalog = {
    hair: {
      male: {
        '现代': [
          ['morden_male_cuntou', '寸头'],
          ['morden_male_beitou', '背头'],
          ['morden_male_youtou', '油头'],
          ['morden_male_duansuifa', '短碎发'],
          ['morden_male_zhongfen', '中分'],
          ['morden_male_juanfa', '卷发'],
        ],
        '古风': [
          ['gufeng_male_shushengshufa', '书生束发'],
          ['gufeng_male_jiangjungaoguanshufa', '将军高冠束发'],
          ['gufeng_male_nandaoji', '男道髻'],
          ['gufeng_male_shaonianchuiji', '少年垂髻'],
          ['gufeng_male_sanfa', '散发'],
        ],
        '民国': [
          ['minguo_male_youliangbeitou', '油亮背头'],
        ],
        '仙侠': [
          ['fantacy_male_fadaishufa', '发带束发'],
          ['fantacy_male_zangbian', '脏辫'],
        ],
        '科幻': [
          ['future_male_liluoduanfa', '利落短发'],
          ['future_male_jihejiancai', '几何剪裁'],
          ['future_male_dancetiaoran', '单侧挑染'],
          ['future_male_jixiepeishi', '机械配饰发型'],
          ['future_male_shuangsejianbian', '双色渐变'],
        ],
        '民族': [
          ['nation_male_minzubianfa', '民族辫发'],
          ['nation_male_toushiyiti', '头饰一体发型'],
        ],
        '儿童': [
          ['kid_male_tonghuatou', '童花头'],
          ['kid_male_nantongcuntou', '男童寸头'],
        ],
      },
      female: {
        '现代': [
          ['morden_female_changzhifa', '长直发'],
          ['morden_male_dabolang', '大波浪'],
          ['morden_male_bobotou', '波波头'],
          ['morden_male_qijianduanfa', '齐肩中短发'],
          ['morden_male_gaomawei', '高马尾'],
          ['morden_male_dimawei', '低马尾'],
          ['morden_male_shuangmawei', '双马尾'],
          ['morden_male_wanzitou', '丸子头'],
          ['morden_male_banzha', '半扎发'],
          ['morden_male_bianfa', '编发'],
          ['morden_male_kongqiliuhai', '空气刘海'],
          ['morden_male_qiliuhai', '齐刘海'],
        ],
        '古风': [
          ['gufeng_female_chuifa', '垂发'],
          ['gufeng_female_gaoji', '高髻'],
          ['gufeng_female_shuanghuanji', '双环髻'],
          ['gufeng_female_feixianji', '飞仙髻'],
          ['gufeng_female_lingsheji', '灵蛇髻'],
          ['gufeng_female_nvguandaoji', '女冠道髻'],
          ['gufeng_female_banshu', '半束'],
          ['gufeng_female_huaguan', '花冠'],
          ['gufeng_female_duomaji', '堕马髻'],
          ['gufeng_female_gongzhubian', '公主辫'],
          ['gufeng_female_bianshengfa', '编绳发'],
        ],
        '民国': [
          ['minguo_female_shoutuibowen', '手推波'],
          ['minguo_female_qipaojuan', '旗袍卷'],
          ['minguo_female_qierxueshengduanfa', '齐耳学生短发'],
        ],
        '仙侠': [
          ['fantacy_female_chaochangpiaofa', '超长飘发'],
          ['fantacy_female_fadaishufa', '发带束发'],
          ['fantacy_female_zangbian', '脏辫'],
          ['fantacy_female_xianqigaopan', '仙气高盘'],
          ['fantacy_female_bianshengfa', '编绳发'],
        ],
        '科幻': [
          ['future_female_liluoduanfa', '利落短发'],
          ['future_female_jihejiancai', '几何剪裁'],
          ['future_female_dancetiaoran', '单侧挑染'],
          ['future_female_jixiepeishi', '机械配饰发型'],
          ['future_female_shuangsejianbian', '双色渐变'],
        ],
        '民族': [
          ['nation_female_minzubianfa', '民族辫发'],
          ['nation_female_toushiyiti', '头饰一体发型'],
        ],
        '儿童': [
          ['kid_female_tonghuatou', '童花头'],
          ['kid_female_xiaobian', '小辫'],
        ],
      },
    },
    makeup: {
      male: {
        '现代': [
          ['morden_male_nanshijingxiu', '男士精修'],
          ['morden_male_luozhuang', '裸妆'],
          ['morden_male_suyan', '素颜'],
          ['morden_male_hanxizhuang', '韩系妆'],
        ],
        '欧美时尚': [
          ['fashion_male_litizhuang', '立体妆'],
          ['fashion_male_hunxueganzhuang', '混血感妆'],
          ['fashion_male_yanxunzhuang', '烟熏妆'],
        ],
        '国潮': [
          ['guochao_male_xiqudanzhuang', '戏曲旦妆'],
          ['guochao_male_xiqushengzhuang', '戏曲生妆'],
        ],
        '特效': [
          ['texiao_male_shangzhuang', '伤妆'],
          ['texiao_male_laonianzhuang', '老年妆'],
          ['texiao_male_guizhuang', '鬼妆/尸妆'],
          ['texiao_male_sangshizhuang', '丧尸妆'],
          ['texiao_male_shengbingzhuangrong', '生病妆'],
        ],
        '儿童': [
          ['kid_male_ertongwuzhuang', '儿童无妆'],
        ],
      },
      female: {
        '现代': [
          ['morden_female_suyan', '素颜'],
          ['morden_female_luozhuang', '裸妆'],
          ['morden_female_taohuafenweizhuang', '桃花氛围妆'],
          ['morden_female_richangdanzhuang', '日常淡妆'],
          ['morden_female_lengyanzhuang', '冷艳妆'],
          ['morden_female_tianmeizhuang', '甜美妆'],
          ['morden_female_hanxizhuang', '韩系妆'],
        ],
        '古代': [
          ['gufeng_female_weijinmeihuazhuang', '魏晋梅花妆'],
          ['gufeng_female_qinhanhongzhuang', '秦汉红妆'],
          ['gufeng_female_qinhanbaizhuang', '秦汉白妆'],
          ['gufeng_female_weijinehuangzhuang', '魏晋额黄妆'],
          ['gufeng_female_weijinxiaoxiazhuang', '魏晋晓霞妆'],
          ['gufeng_female_tangsanbaizhuang', '唐三白妆'],
          ['gufeng_female_tangtaohuazhuang', '唐桃花妆'],
          ['gufeng_female_tanghuaxizhuang', '唐花钿妆'],
          ['gufeng_female_tangfeixiazhuang', '唐飞霞妆'],
          ['gufeng_female_tangjiuyunzhuang', '唐酒晕妆'],
          ['gufeng_female_songzhenzhuhuaxizhuang', '宋珍珠花钿妆'],
          ['gufeng_female_mingsuzhuang', '明素妆'],
          ['gufeng_female_qingqizhuang', '清旗妆'],
        ],
        '欧美时尚': [
          ['fashion_female_litizhuang', '立体妆'],
          ['fashion_female_fuguhongchunzhuang', '复古红唇妆'],
          ['fashion_female_yanxunzhuang', '烟熏妆'],
          ['fashion_female_hunxiezhuang', '混血妆'],
          ['fashion_female_jinshuhuancaizhuang', '金属幻彩妆'],
        ],
        '国潮': [
          ['guochao_female_guochaozhuang', '国潮妆'],
          ['guochao_female_wutainongzhuang', '舞台浓妆'],
          ['guochao_female_xiqudanzhuang', '戏曲旦妆'],
          ['guochao_female_xiqushengzhuang', '戏曲生妆'],
        ],
        '特效': [
          ['texiao_female_shengbingzhuangrong', '生病妆容'],
          ['texiao_female_guizhuang', '鬼妆/尸妆'],
          ['texiao_female_sangshizhuang', '丧尸妆'],
          ['texiao_female_laonianzhuang', '老年妆'],
          ['texiao_female_shangzhuang', '伤妆'],
        ],
        '民国': [
          ['minguo_female_minguozhuang', '民国妆'],
        ],
        '儿童': [
          ['kid_female_ertongwuzhuang', '儿童无妆'],
        ],
      },
    },
    outfit: {
      male: {
        '现代': [
          ['morden_male_bianzhuang_1', '便装_1'],
          ['morden_male_bianzhuang_2', '便装_2'],
          ['morden_male_xizhuang_1', '西装_1'],
          ['morden_male_xizhuang_2', '西装_2'],
          ['morden_male_xizhuang_3', '西装_3'],
          ['morden_male_xiuxian_1', '休闲_1'],
          ['morden_male_xiuxian_2', '休闲_2'],
          ['morden_male_yundong_1', '运动_1'],
          ['morden_male_yundong_2', '运动_2'],
          ['morden_male_xiaofu_1', '校服_1'],
          ['morden_male_xiaofu_2', '校服_2'],
          ['morden_male_jiake_1', '夹克_1'],
          ['morden_male_jiake_2', '夹克_2'],
        ],
        '古风': [
          ['gufeng_male_yuanlingpao', '圆领袍'],
          ['gufeng_male_zhiju', '直裾'],
          ['gufeng_male_guanfu', '官服'],
          ['gufeng_male_kaijia', '铠甲'],
          ['gufeng_male_nandaopao', '道袍'],
          ['gufeng_male_shushengchangshan', '书生长衫'],
          ['gufeng_male_jingzhuang', '劲装'],
        ],
        '仙侠': [
          ['fantacy_male_xianfu', '仙服'],
          ['fantacy_male_yizufu', '异族服'],
          ['fantacy_male_fapao', '法袍'],
          ['fantacy_male_zhanpao', '战袍'],
        ],
        '民国': [
          ['minguo_male_changshan_1', '长衫_1'],
          ['minguo_male_changshan_2', '长衫_2'],
          ['minguo_male_xishilifu_1', '西式礼服_1'],
          ['minguo_male_xishilifu_2', '西式礼服_2'],
          ['minguo_male_xishilifu_3', '西式礼服_3'],
          ['minguo_male_junzhuang_1', '军装_1'],
          ['minguo_male_junzhuang_2', '军装_2'],
        ],
        '科幻': [
          ['future_male_jinengzhuang_1', '机能装_1'],
          ['future_male_jinengzhuang_2', '机能装_2'],
          ['future_male_zhifu_1', '制服_1'],
          ['future_male_zhifu_2', '制服_2'],
          ['future_male_zhanjia_1', '战甲_1'],
          ['future_male_zhanjia_2', '战甲_2'],
          ['future_male_zhanjia_3', '战甲_3'],
          ['future_male_zhanjia_4', '战甲_4'],
          ['future_male_saibojiake_1', '赛博夹克_1'],
          ['future_male_saibojiake_2', '赛博夹克_2'],
        ],
        '礼服': [
          ['formal_male_yanweifu_1', '燕尾服_1'],
          ['formal_male_yanweifu_2', '燕尾服_2'],
          ['formal_male_yanweifu_3', '燕尾服_3'],
        ],
        '民族': [
          ['minzu_male_boximiyayoumufeng', '波希米亚游牧风'],
          ['minzu_male_miaozu', '苗族'],
          ['minzu_male_zangzu', '藏族'],
          ['minzu_male_mengguzu', '蒙古族'],
        ],
      },
      female: {
        '现代': [
          ['morden_female_bianzhuang_1', '便装_1'],
          ['morden_female_bianzhuang_2', '便装_2'],
          ['morden_female_bianzhuang_3', '便装_3'],
          ['morden_female_lianyiqun_1', '连衣裙_1'],
          ['morden_female_lianyiqun_2', '连衣裙_2'],
          ['morden_female_lianyiqun_3', '连衣裙_3'],
          ['morden_female_lianyiqun_4', '连衣裙_4'],
          ['morden_female_zhiyexizhuang_1', '职业西装_1'],
          ['morden_female_zhiyexizhuang_2', '职业西装_2'],
          ['morden_female_tongqin', '通勤'],
          ['morden_female_yundong_1', '运动_1'],
          ['morden_female_yundong_2', '运动_2'],
          ['morden_female_yundong_3', '运动_3'],
          ['morden_female_yundong_4', '运动_4'],
          ['morden_female_JKzhifu_1', 'JK制服_1'],
          ['morden_female_JKzhifu_2', 'JK制服_2'],
          ['morden_female_xiaofu_1', '校服_1'],
          ['morden_female_xiaofu_2', '校服_2'],
          ['morden_female_xiaofu_3', '校服_3'],
          ['morden_female_jietou_1', '街头_1'],
          ['morden_female_jietou_2', '街头_2'],
          ['morden_female_jiaju_1', '家居_1'],
          ['morden_female_jiaju_2', '家居_2'],
          ['morden_female_jiaju_3', '家居_3'],
        ],
        '古风': [
          ['gufeng_female_qixiongruqun', '齐胸襦裙'],
          ['gufeng_female_jiaolingruqun', '交领襦裙'],
          ['gufeng_female_quju', '曲裾'],
          ['gufeng_female_qiyaoruqun', '齐腰襦裙'],
          ['gufeng_female_daxiushan', '大袖衫'],
          ['gufeng_female_gongzhuang', '宫装'],
          ['gufeng_female_nvzhanjia', '战甲'],
          ['gufeng_female_nvdaopao', '道袍'],
        ],
        '仙侠': [
          ['fantacy_female_xianfu', '仙服'],
          ['fantacy_female_yizufu', '异族服'],
          ['fantacy_female_yuyi', '羽衣'],
          ['fantacy_female_fapao', '法袍'],
          ['fantacy_female_zhanpao', '战袍'],
        ],
        '民国': [
          ['minguo_female_qipao_1', '旗袍_1'],
          ['minguo_female_qipao_2', '旗袍_2'],
          ['minguo_female_qipao_3', '旗袍_3'],
          ['minguo_female_gailiangqipao_1', '改良旗袍_1'],
          ['minguo_female_gailiangqipao_2', '改良旗袍_2'],
          ['minguo_female_xueshengzhuang', '学生装'],
          ['minguo_female_xishilifu_1', '西式礼服_1'],
          ['minguo_female_xishilifu_2', '西式礼服_2'],
          ['minguo_female_xishilifu_3', '西式礼服_3'],
          ['minguo_female_nvjunzhuang', '军装'],
        ],
        '科幻': [
          ['future_female_jinengzhuang_1', '机能装_1'],
          ['future_female_jinengzhuang_2', '机能装_2'],
          ['future_female_zhifu_1', '制服_1'],
          ['future_female_zhifu_2', '制服_2'],
          ['future_female_zhanjia_1', '战甲_1'],
          ['future_female_zhanjia_2', '战甲_2'],
          ['future_female_zhanjia_3', '战甲_3'],
          ['future_female_zhanjia_4', '战甲_4'],
          ['future_female_saibojiake', '赛博夹克'],
        ],
        '礼服': [
          ['formal_female_hunsha_1', '婚纱_1'],
          ['formal_female_hunsha_2', '婚纱_2'],
          ['formal_female_wanlifu_1', '晚礼服_1'],
          ['formal_female_wanlifu_2', '晚礼服_2'],
        ],
        '民族': [
          ['minzu_female_boximiyayoumufeng', '波希米亚游牧风'],
          ['minzu_female_miaozu', '苗族'],
          ['minzu_female_zangzu', '藏族'],
          ['minzu_female_mengguzu', '蒙古族'],
        ],
      },
    },
  };

  function stylingFields(groupId, fieldId, label, catalog) {
    const groupsByGender = {};
    const labels = {}, images = {};
    for (const [gender, categories] of Object.entries(catalog)) {
      const byCategory = {};
      for (const [category, records] of Object.entries(categories)) {
        byCategory[category] = records.map(([id]) => id);
        for (const [id, name] of records) {
          labels[id] = name;
          images[id] = 'assets/role-studio/catalog/' + id + '.jpg';
        }
      }
      groupsByGender[gender] = byCategory;
    }
    const categories = [...new Set([...Object.keys(catalog.male), ...Object.keys(catalog.female)])];
    groupsByGender.any = Object.fromEntries(categories.map(category => [category, [
      ...(groupsByGender.male[category] || []), ...(groupsByGender.female[category] || []),
    ]]));
    const optionsByGender = { male: Object.keys(catalog.male), female: Object.keys(catalog.female), any: categories };
    return [
      { ...choice(groupId, label, [...new Set([...optionsByGender.male, ...optionsByGender.female])]), optionsByGender, filterOnly: true },
      { ...cards(fieldId, label + '预设', Object.keys(labels)), toggleable: true, dependsOn: groupId, groups: groupsByGender.male, groupsByGender, labels, images },
    ];
  }

  const palette = (values) => Object.fromEntries(values.map(value => [value, value]));
  const hairColors = palette([
    '#0b0b0b', '#23170b', '#5c3518', '#80512d', '#ac7650',
    '#d2a27d', '#6c5a4e', '#818181', '#d8d0c4', '#f0e2c8',
  ]);
  const lipColors = palette([
    '#662630', '#8f3341', '#b24454', '#c85f6a', '#8e3b52',
    '#9d5266', '#b56f71', '#d28b8a', '#6f3541', '#d3a29f',
  ]);

  window.CanvasFlowRoleModes = [
    {
      id: 'face', label: '脸部精修', tabs: [
        tab('skin', '皮肤', [
          range('smooth', '质感磨皮'),
          generationOnly(range('beauty', 'AI 美颜（脸部）')),
          range('texture', '皮肤纹理（脸部）'),
          range('glow', '皮肤透亮'), range('rosy', '皮肤红润'),
          range('whiten', '皮肤美白'), generationOnly({ id: 'blemish', label: '祛斑祛痘', type: 'switch', default: false }),
        ]),
        tab('eyes', '眉眼', [
          generationOnly(range('darkCircles', '祛黑眼圈')),
          range('brightEyeLeft', '亮眼（左）'), range('brightEyeRight', '亮眼（右）'),
          ...paired('eyeSize', '眼睛大小'), ...paired('eyeWidth', '眼宽'),
          ...paired('eyeHeight', '眼高'), ...paired('eyeDistance', '眼距'),
          ...paired('eyeLid', '眼睑', true), ...paired('eyeTilt', '眼睛倾斜', true),
          ...paired('innerEye', '开眼角', true), ...paired('eyePosition', '眼睛上下', true),
          ...paired('browDistance', '眉毛间距'), ...paired('browHeight', '眉毛上下'),
          ...paired('browArch', '眉峰'), ...paired('browSize', '眉毛粗细'),
          ...paired('browTilt', '眉毛倾斜'), range('browDeepen', '眉毛增强'),
          materialCards('eyeLight', '眼神光', 'eye-light', eyeLights),
          ...eyeLightFields,
        ]),
        tab('nose', '鼻子', [
          adjust('nasalRoot', '山根'), adjust('noseBridge', '鼻梁'), adjust('noseTip', '鼻尖'),
          adjust('noseLength', '鼻子长短'), adjust('noseSize', '鼻子大小'), adjust('noseWidth', '鼻翼'),
        ]),
        tab('lips', '嘴唇', [
          adjust('mouthHeight', '嘴巴上下'), adjust('lowerLip', '丰下唇'), adjust('lipWidth', '嘴巴宽度'),
          adjust('plumpLips', '丰唇'), adjust('lipCorner', '嘴角调整'), adjust('mouthTilt', '嘴巴倾斜'),
          adjust('mouthSize', '嘴巴大小'), adjust('upperLip', '丰上唇'),
          generationOnly(range('lipLines', '祛唇纹')), range('lipIntensity', '唇妆增强'),
        ]),
        tab('shape', '脸部', [
          adjust('forehead', '额头'), adjust('vFace', 'V 脸'), generationOnly(range('contourSmooth', '脸部轮廓流畅')),
          range('smallFace', '小脸'), adjust('faceWidth', '脸部宽度'), adjust('chinHeight', '下巴高度'),
          ...paired('jaw', '下颌'), ...paired('cheekbone', '颧骨'), ...paired('temple', '太阳穴'),
          adjust('middleFace', '中庭'), adjust('lowerFace', '下庭'), adjust('philtrum', '人中'),
        ]),
        tab('makeup', '妆造', [
          { ...choice('makeupCategory', '妆容分类', faceMakeup.map(item => item.label)), filterOnly: true },
          ...makeupFields,
        ]),
      ],
    },
    {
      id: 'features', label: '脸部 & 身体特征', tabs: [
        tab('marks', '纹身 & 疤痕', [
          {
            ...cards('mark', '纹身 & 疤痕', ['痣', '疤痕_深', '疤痕_浅', '全脸雀斑', '脸颊雀斑', '自定义']),
            images: {
              '痣': 'assets/role-studio/sticker_mole.png',
              '疤痕_深': 'assets/role-studio/sticker_scar_1.png',
              '疤痕_浅': 'assets/role-studio/sticker_scar_2.png',
              '全脸雀斑': 'assets/role-studio/sticker_facefreckles.png',
              '脸颊雀斑': 'assets/role-studio/sticker_cheekfreckles.png',
            },
          },
        ]),
      ],
    },
    {
      id: 'body', label: '身材塑形', tabs: [
        tab('figure', '身材塑形', [
          adjust('bust', '丰胸'), range('stature', 'AI 增高'),
          generationOnly(range('posture', '驼背')),
          range('legLength', '长腿'), range('shoulderAngle', '直角肩'),
          range('headRatio', '小头'), adjust('bodyWidth', '瘦身'),
          range('belly', '瘦肚子'), adjust('upperArms', '瘦手臂'),
          adjust('hips', '美臀'), range('thighs', '瘦腿'),
          generationOnly(range('slimNeckLeft', '瘦脖子-左')),
          generationOnly(range('slimNeckRight', '瘦脖子-右')),
          range('waist', '美腰'),
          generationOnly(range('neckLengthLeft', '天鹅颈-左')),
          generationOnly(range('neckLengthRight', '天鹅颈-右')),
          adjust('shoulders', '肩膀宽度'),
          generationOnly(range('reshape', '全身美型')),
        ]),
      ],
    },
    {
      id: 'outfit', label: '服装造型', tabs: [
        tab('styling', '造型', [
          ...stylingFields('hairGroup', 'hairstyle', '发型', stylingCatalog.hair),
          { ...swatches('hairColor', '发色', hairColors, true), default: '#0b0b0b', toggleable: true },
          ...stylingFields('makeupGroup', 'makeup', '妆容', stylingCatalog.makeup),
          { ...swatches('lipColor', '口红', lipColors), default: '#8f3341', toggleable: true },
        ]),
        tab('clothes', '服装', [
          ...stylingFields('outfitGroup', 'wardrobe', '服装', stylingCatalog.outfit),
        ]),
        tab('ai', 'AI 生成', [
          description('outfitNotes', '人设定制造型', '描述或上传参考图，复刻发型 / 妆造 / 服装'),
          { ...choice('stylingSkill', '造型技能', ['不使用技能', '妆造复刻', '人设定制造型'], '人设定制造型'), display: 'select' },
        ]),
      ],
    },
    {
      id: 'voice', label: '音色音调', tabs: [
        tab('timbre', '音色', [
          choice('timbre', '音色风格', ['自然', '清亮', '温柔', '沉稳', '浑厚', '沙哑']),
          description('voiceNotes', '声音描述', '描述角色声音的年龄感、质感或说话习惯'),
        ]),
        tab('delivery', '音调', [
          range('pitch', '音高', 0.5, 2, 1, 0.05),
          range('rate', '语速', 0.5, 2, 1, 0.05),
          choice('tone', '语气', ['自然', '轻快', '平静', '严肃', '激动']),
        ]),
      ],
    },
  ];
})();
