/* Food Max 商家端 v2 · 送货退货组（送货签到 / 装筐送货 / 交货进度 / 退货取回）
   还原快驴卖家App 9 张参考截图；SG 仓(裕廊/兀兰/盛港/大巴窑/淡滨尼/义顺 DC) + S$
   评审修复内建：列表先 skel→数据 / 装筐空态用 .empty / 破坏性(不需要提货·放弃所有权)用 confirmDialog / 可点元素≥44px */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel,cdSpan,arriveDueMs}=window.FM;

const css=document.createElement('style');
css.textContent=`
.dl-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;}
.dl-bar .dt{font-size:20px;font-weight:700;}
.dl-bar .rec{font-size:13.5px;color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;gap:2px;}
.dl-banner{margin:0 16px 4px;background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.55;padding:11px 14px;border-radius:12px;display:flex;gap:10px;align-items:flex-start;}
.dl-banner .x{flex:0 0 auto;color:var(--sub);font-size:16px;min-width:24px;min-height:24px;text-align:right;cursor:pointer;}
.dl-banner .hp{flex:0 0 auto;color:var(--sub);}
.dl-priv{display:flex;align-items:center;justify-content:space-between;margin:8px 16px 4px;background:#fff;border-radius:12px;padding:0 14px;min-height:48px;box-shadow:var(--sh-sm);font-size:13.5px;color:#27433A;}
.dl-priv .ed{color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;}
.dl-list{padding:10px 16px 16px;}
.dl-card{background:#fff;border-radius:18px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.dl-ch{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);}
.dl-ch .no{font-weight:700;color:#27433A;letter-spacing:.01em;}
.dl-ch .st{margin-left:auto;font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:3px;}
.dl-ch .st.ok{color:var(--emerald);}.dl-ch .st.wait{color:var(--red);}
.dl-tagline{display:flex;align-items:center;gap:9px;margin-top:11px;}
.dl-tag{flex:0 0 auto;font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:var(--mint-soft);color:var(--emerald-2);}
.dl-tagline .v{font-size:15px;font-weight:700;}
.dl-sign{display:flex;align-items:center;gap:6px;margin-top:11px;font-size:12.5px;color:#46604F;flex-wrap:wrap;}
.dl-sign .lb{color:var(--sub);}.dl-sign b{color:var(--emerald);font-weight:700;}
.dl-sign .more{margin-left:auto;color:var(--sub);min-height:30px;display:flex;align-items:center;}
.dl-meta{display:flex;margin-top:10px;font-size:12.5px;line-height:1.5;}
.dl-meta .k{flex:0 0 64px;color:var(--sub);}.dl-meta .vv{flex:1;color:#27433A;}
.dl-kbox{display:flex;background:var(--muted);border-radius:14px;margin-top:13px;padding:14px 0;}
.dl-kbox .k{flex:1;text-align:center;}
.dl-kbox .k+.k{border-left:1px solid var(--line);}
.dl-kbox .k .v{font-size:21px;font-weight:600;font-family:'Lora',serif;}
.dl-kbox .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.dl-acts{display:flex;gap:8px;margin-top:13px;}
.ck-go{margin-top:13px;min-height:46px;border-radius:12px;background:var(--emerald);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.ck-go.red{background:var(--red);box-shadow:none;}
.ck-done{margin-top:11px;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--sub);background:var(--muted);border-radius:11px;padding:0 12px;cursor:pointer;}
.ck-tip{background:var(--mint-soft);color:#27433A;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px;margin-bottom:10px;}
.ck-tip.red{background:var(--red-soft);color:var(--red);}
.ck-list{background:#fff;border-radius:14px;box-shadow:var(--sh-sm);overflow:hidden;}
.ck-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);}
.ck-row:last-child{border-bottom:none;}
.ck-row.short{background:#FEF5F5;}
.ck-n{font-weight:700;font-size:14.5px;}
.ck-s{font-size:12px;color:var(--sub);margin-top:3px;}
.ck-ro{font-family:'Lora',serif;font-size:18px;font-weight:700;}
.ck-stp{display:flex;align-items:center;border:1px solid var(--line);border-radius:12px;overflow:hidden;flex:0 0 auto;}
.ck-stp button{width:44px;height:44px;border:none;background:var(--muted);font-size:20px;color:#27433A;cursor:pointer;}
.ck-stp button:disabled{opacity:.35;}
.ck-stp input{width:52px;height:44px;border:none;text-align:center;font-size:16px;font-weight:700;font-family:inherit;}
.ck-stp.sm .v{min-width:40px;text-align:center;font-weight:700;font-size:15px;}
.ck-row.full{background:#F2FBF7;}
.ck-bar{height:4px;border-radius:4px;background:var(--line);margin-top:7px;overflow:hidden;width:150px;}
.ck-bar i{display:block;height:100%;background:var(--emerald);border-radius:4px;}
.ck-seg{display:flex;background:var(--muted);border-radius:12px;padding:4px;margin-bottom:10px;}
.ck-seg .sg{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:13.5px;font-weight:700;color:var(--sub);cursor:pointer;}
.ck-seg .sg.on{background:#fff;color:var(--emerald-2);box-shadow:var(--sh-sm);}
.ck-scanbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:96px;border-radius:16px;background:var(--emerald);color:#fff;margin-bottom:12px;cursor:pointer;box-shadow:0 8px 20px rgba(5,150,105,.3);}
.ck-scanbtn svg{width:28px;height:28px;stroke:#fff;}
.ck-scanbtn span{font-size:18px;font-weight:800;letter-spacing:2px;}
.ck-scanbtn em{font-style:normal;font-size:12px;opacity:.85;}
.ck-cam{position:absolute;inset:0;z-index:300;background:#0B1512;color:#fff;display:flex;flex-direction:column;padding:48px 16px 20px;}
.ck-cam .top{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:15px;}
.ck-cam .top .x{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;}
.ck-cam .vf{position:relative;width:230px;height:230px;margin:22px auto 14px;}
.ck-cam .vf i{position:absolute;width:30px;height:30px;border-color:#34D399;border-style:solid;}
.ck-cam .c1{top:0;left:0;border-width:4px 0 0 4px;border-radius:8px 0 0 0}.ck-cam .c2{top:0;right:0;border-width:4px 4px 0 0;border-radius:0 8px 0 0}
.ck-cam .c3{bottom:0;left:0;border-width:0 0 4px 4px;border-radius:0 0 0 8px}.ck-cam .c4{bottom:0;right:0;border-width:0 4px 4px 0;border-radius:0 0 8px 0}
.ck-cam .ln{position:absolute;left:12px;right:12px;height:2px;background:#34D399;box-shadow:0 0 12px #34D399;animation:ckscan 1.8s ease-in-out infinite;}
@keyframes ckscan{0%{top:12px}50%{top:214px}100%{top:12px}}
.ck-cam .hint{position:absolute;bottom:-26px;left:-20px;right:-20px;text-align:center;font-size:12px;color:rgba(255,255,255,.65);}
.ck-cam .res{margin-top:22px;min-height:46px;border-radius:12px;padding:11px 14px;font-size:13.5px;background:rgba(255,255,255,.08);text-align:center;}
.ck-cam .res.ok{background:rgba(16,185,129,.22);color:#A7F3D0;}
.ck-cam .res.err{background:rgba(220,38,38,.28);color:#FECACA;}
.ck-cam .tally{margin-top:10px;font-size:13px;color:rgba(255,255,255,.8);display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:center;align-items:baseline;}
.ck-cam .tally b{font-size:22px;color:#fff;font-family:'Lora',serif;}
.ck-cam .tally span{font-size:11.5px;background:rgba(255,255,255,.08);padding:3px 8px;border-radius:20px;}
.ck-cam .demo{margin-top:auto;border:1px dashed rgba(255,255,255,.25);border-radius:12px;padding:10px;}
.ck-cam .dm-t{font-size:11.5px;color:rgba(255,255,255,.6);margin-bottom:8px;}
.ck-cam .dm-b{display:flex;flex-wrap:wrap;gap:6px;}
.ck-cam .dm-b span{font-size:12px;padding:0 10px;min-height:34px;display:flex;align-items:center;border-radius:9px;background:rgba(255,255,255,.12);cursor:pointer;}
.ck-cam .alarm{margin-top:14px;border-radius:12px;padding:10px 12px;background:#DC2626;color:#fff;font-size:13.5px;display:flex;align-items:center;gap:10px;justify-content:space-between;animation:ckpulse 1s ease-in-out infinite alternate;}
.ck-cam .alarm span{flex:0 0 auto;background:#fff;color:#DC2626;font-weight:800;border-radius:10px;padding:0 12px;min-height:40px;display:flex;align-items:center;cursor:pointer;}
@keyframes ckpulse{from{box-shadow:0 0 0 0 rgba(220,38,38,.6)}to{box-shadow:0 0 0 8px rgba(220,38,38,0)}}
.ck-cam .tally span.off{background:#DC2626;color:#fff;}
.ck-cam .done.go{background:#fff;color:#059669;}
.ck-cam .done{margin-top:12px;min-height:48px;border-radius:14px;background:#10B981;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;cursor:pointer;}
.dl-acts .a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;padding:0 4px;}
.dl-acts .a.key{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
/* 记录行 */
.dl-rec{background:#fff;border-radius:16px;padding:14px 15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.dl-rec .r1{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--sub);}
.dl-rec .r1 .no{font-weight:700;color:#27433A;}
.dl-rec .r1 .st{font-weight:700;}.dl-rec .r1 .st.ok{color:var(--emerald);}.dl-rec .r1 .st.wait{color:var(--red);}
.dl-rec .r2{display:flex;align-items:center;justify-content:space-between;margin-top:9px;}
.dl-rec .r2 .ware{font-size:16px;font-weight:700;}.dl-rec .r2 .w{font-size:13px;color:#46604F;}
.dl-rec .r3{display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12.5px;color:#46604F;}
.dl-rec .r3 .d{color:var(--emerald);font-weight:700;min-height:30px;display:flex;align-items:center;}
.dl-rec .r3 .seg{color:var(--sub);}
/* 筛选下拉条 */
.dl-filters{display:flex;gap:18px;padding:12px 16px;overflow-x:auto;}.dl-filters::-webkit-scrollbar{display:none;}
.dl-drop{flex:0 0 auto;font-size:14px;color:#27433A;font-weight:600;min-height:44px;display:flex;align-items:center;gap:4px;cursor:pointer;}
.dl-drop .ca{font-size:10px;color:var(--sub);}
/* Tab 条 */
.dl-tabs{display:flex;gap:26px;padding:6px 16px 0;border-bottom:1px solid var(--line);}
.dl-tabs .t{font-size:15px;color:var(--sub);font-weight:600;padding:10px 0 12px;position:relative;cursor:pointer;min-height:44px;}
.dl-tabs .t.on{color:var(--emerald);font-weight:700;}
.dl-tabs .t.on::after{content:"";position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:26px;height:3px;border-radius:3px;background:var(--emerald);}
/* 详情 / 二维码 */
.dl-head{background:var(--mint-soft);margin:0 0 2px;padding:14px 16px 16px;}
.dl-head .no{font-size:12.5px;color:var(--emerald-2);}
.dl-head .ware{font-size:20px;font-weight:800;margin:8px 0 10px;}
.dl-head .ln{display:flex;align-items:center;gap:9px;margin-top:8px;font-size:13px;color:#27433A;}
.dl-head .ln .k{flex:0 0 60px;color:var(--emerald-2);}
.dl-qrcard{background:#fff;border-radius:16px;margin:14px 16px;padding:18px;box-shadow:var(--sh-sm);text-align:center;}
.dl-qrcard .qt{font-size:16px;font-weight:700;margin-bottom:12px;}
.dl-qr{width:188px;height:188px;margin:0 auto;display:grid;grid-template-columns:repeat(25,1fr);grid-template-rows:repeat(25,1fr);}
.dl-qr i{display:block;}.dl-qr i.b{background:var(--ink);}
.dl-tbl{margin:12px 16px;}
.dl-tbl .th,.dl-tbl .tr{display:flex;align-items:flex-start;padding:11px 4px;font-size:13px;}
.dl-tbl .th{color:var(--sub);font-size:12px;border-bottom:1px solid var(--line);}
.dl-tbl .tr{border-bottom:1px solid var(--line);}
.dl-tbl .c1{flex:1;color:#27433A;}.dl-tbl .c1 .sp{font-size:11px;color:var(--sub);margin-top:2px;}
.dl-tbl .c2,.dl-tbl .c3{flex:0 0 56px;text-align:right;font-weight:600;}
/* 交货进度卡 */
.dl-glabel{font-size:15px;font-weight:700;padding:10px 16px 4px;}
.dl-pcard{background:#fff;border-radius:18px;margin:8px 16px 13px;padding:16px;box-shadow:var(--sh-sm);}
.dl-pcard .dept{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;}
.dl-pcard .dept .nm{font-size:18px;font-weight:800;}.dl-pcard .dept .tot{font-size:14px;color:#27433A;font-weight:700;}
.dl-pw{padding:13px 0;border-top:1px solid var(--line);}
.dl-pw .wn{font-size:16px;font-weight:700;display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.dl-pw .wn .tm{font-size:12px;color:var(--sub);font-weight:500;flex:0 0 auto;}
.dl-pw .mx{display:flex;margin-top:11px;}
.dl-pw .mx .m{flex:1;}
.dl-pw .mx .m .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}
.dl-pw .mx .m .v.wait{color:var(--emerald);}
.dl-pw .mx .m .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
.dl-pw .sub2{display:flex;align-items:center;gap:12px;margin-top:9px;font-size:11.5px;}
.dl-pw .sub2 .bt{color:#B45309;}.dl-pw .sub2 .ud{color:var(--red);font-weight:700;}
.dl-pw .pacts{display:flex;gap:9px;margin-top:12px;}
.dl-pw .pacts .b{flex:1;min-height:42px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13px;font-weight:600;background:var(--muted);color:#27433A;cursor:pointer;}
/* 退货单 */
.dl-rcard{background:#fff;border-radius:16px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.dl-rcard .r1{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sub);flex-wrap:wrap;}
.dl-rcard .r1 .no{font-weight:700;color:#27433A;}
.dl-rcard .r1 .lbl{font-size:10.5px;border:1px solid var(--line);color:#46604F;padding:1px 6px;border-radius:5px;}
.dl-rcard .r1 .st{margin-left:auto;color:var(--emerald);font-weight:700;min-height:30px;display:flex;align-items:center;}
.dl-rcard .r2{display:flex;align-items:center;justify-content:space-between;margin-top:10px;}
.dl-rcard .r2 .ware{font-size:16px;font-weight:700;display:flex;align-items:center;gap:7px;}
.dl-rcard .r2 .ware .dot{width:7px;height:7px;border-radius:50%;background:var(--red);}
.dl-rcard .r2 .cnt{font-size:14px;font-weight:700;}
.dl-rcard .info{margin-top:9px;font-size:12.5px;color:var(--sub);line-height:1.7;}
.dl-rcard .info .code{color:var(--emerald);font-weight:700;}
.dl-rcard .info .dl-deadline{color:var(--sub);}
.dl-rcard .rb{display:flex;justify-content:flex-end;margin-top:11px;}
.dl-rcard .rb .b{min-height:40px;display:flex;align-items:center;padding:0 18px;border-radius:11px;font-size:13.5px;font-weight:700;border:1px solid var(--emerald);color:var(--emerald);cursor:pointer;}
/* 弹层(底部抽屉式表单) */
.dl-sheet-mask{position:absolute;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;animation:fade .2s;}
.dl-sheet{width:100%;background:#fff;border-radius:22px 22px 0 0;animation:rise .25s;display:flex;flex-direction:column;max-height:88%;}
.dl-sheet .sh{display:flex;align-items:center;justify-content:center;position:relative;padding:18px 16px 12px;font-size:17px;font-weight:700;}
.dl-sheet .sh .x{position:absolute;right:16px;top:14px;font-size:20px;color:var(--sub);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;}
.dl-sheet .sbody{padding:0 18px 8px;overflow-y:auto;}
.dl-sheet .tip{background:var(--muted);color:#46604F;font-size:12.5px;padding:9px 12px;border-radius:10px;display:flex;gap:7px;align-items:flex-start;}
.dl-sheet .qh{font-size:15px;font-weight:700;margin:18px 0 12px;}
.dl-radios{display:flex;gap:30px;}
.dl-radio{display:flex;align-items:center;gap:8px;font-size:15px;cursor:pointer;min-height:44px;}
.dl-radio .rc{width:22px;height:22px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 22px;display:flex;align-items:center;justify-content:center;}
.dl-radio.on .rc{border-color:var(--emerald);background:var(--emerald);}
.dl-radio.on .rc::after{content:"✓";color:#fff;font-size:12px;font-weight:700;}
.dl-radio.danger.on .rc{border-color:var(--red);background:var(--red);}
.dl-field{background:var(--muted);border-radius:12px;min-height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-size:14px;color:var(--sub);margin-top:10px;cursor:pointer;}
.dl-field.has{color:var(--ink);font-weight:600;}
.dl-warn{color:var(--red);font-size:12.5px;margin:12px 0 8px;line-height:1.5;}
.dl-reason{display:flex;flex-direction:column;}
.dl-reason .dl-radio{border-bottom:1px solid var(--line);justify-content:space-between;flex-direction:row-reverse;}
.dl-sheet .sfoot{padding:12px 16px 18px;border-top:1px solid var(--line);}
/* 新建退货单 */
.dl-sec{font-size:15px;font-weight:700;margin:16px 16px 8px;}
.dl-form{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.dl-frow{display:flex;align-items:center;justify-content:space-between;padding:0 15px;min-height:52px;font-size:14.5px;}
.dl-frow+.dl-frow{border-top:1px solid var(--line);}
.dl-frow .lb{font-weight:600;}.dl-frow .lb .req{color:var(--red);margin-right:2px;}
.dl-frow .sel{color:var(--sub);display:flex;align-items:center;gap:4px;min-height:44px;cursor:pointer;}
.dl-frow .sel.has{color:var(--ink);font-weight:600;}
.dl-add{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);min-height:62px;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--emerald);font-size:15px;font-weight:700;cursor:pointer;}
.dl-item{background:#fff;border-radius:14px;margin:10px 16px 0;padding:13px 15px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;}
.dl-item .ig{font-size:26px;width:48px;height:48px;border-radius:12px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.dl-item .it{flex:1;}.dl-item .it .nm{font-size:14.5px;font-weight:700;}.dl-item .it .sp{font-size:12px;color:var(--sub);margin-top:2px;}
.dl-item .del{color:var(--red);font-size:13px;min-height:44px;display:flex;align-items:center;cursor:pointer;}
.dl-foot2{display:flex;align-items:center;gap:12px;}
.dl-foot2 .sum{font-size:13.5px;color:#27433A;}.dl-foot2 .sum b{font-family:'Lora',serif;font-size:17px;color:var(--emerald-2);}
.dl-foot2 .btn{flex:0 0 auto;width:auto;padding:0 28px;}
/* 二维码弹窗 */
.dl-qrmask{position:absolute;inset:0;z-index:130;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:34px;animation:fade .2s;}
.dl-qrpop{background:#fff;border-radius:18px;width:100%;max-width:300px;overflow:hidden;animation:rise .25s;}
.dl-qrpop .ph{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px;}
.dl-qrpop .ph .t{font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dl-qrpop .ph .x{font-size:20px;color:var(--sub);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;}
.dl-qrpop .qrwrap{padding:0 22px 8px;}
.dl-qrpop .cap{text-align:center;color:var(--emerald);font-weight:700;font-size:15px;padding:14px;min-height:44px;}
`;
document.head.appendChild(css);

const ADDR={'裕廊DC':'1 Jurong West Ave 1, #01-23 裕廊配送中心三号库','兀兰DC':'30 Woodlands Loop, #01-08 兀兰配送中心','盛港DC':'33 Sengkang West Ave, #01-15 盛港提揽点','大巴窑DC':'5 Toa Payoh Ind Park, #01-02 大巴窑配送中心','淡滨尼DC':'10 Tampines St 92, #01-19 淡滨尼配送中心','义顺DC':'8 Yishun Ind St 1, #01-11 义顺配送中心'};
// 各 DC 收货人 / 入门位置（送货单详情·交货地点信息）
const RECV={'裕廊DC':{d:'王志明 8123****7813',n:'林国强 9012****0250',g:'裕廊西门进，2号库3号闸口，只收不卸'},'兀兰DC':{d:'黄俊 8765****1122',n:'李文 9033****3344',g:'兀兰北门进，8号库1楼9–11号门'},'盛港DC':{d:'吴成 8201****5566',n:'/ 9111****1111',g:'东门进，1号平台，只收不卸'},'大巴窑DC':{d:'许尚 8678****7788',n:'史金超 9158****0250',g:'中门进，只收不卸'},'淡滨尼DC':{d:'周强 8299****9900',n:'郑凯 9088****2233',g:'A门进，3号卸货区'},'义顺DC':{d:'马良 8322****4455',n:'孙浩 9077****6677',g:'西门进，2号库'}};
function dvWave(d){const h=parseInt((d.window||'0'),10);return h<12?'上午达':'下午达';}                 // 履约波次(由送达时段派生)
// 商品明细按SKU聚合(件)；demoLines 带 recvQty=仓库收货清点(出库前)回写的实收数量。
// 差异双向：实收<应送=短收；实收>应送=多收（BR-16c 仓库照收不设上限，多收入在仓寄存库存、当日不可卖）
function dvSku(d){
  if(d.demoLines)return d.demoLines.map(l=>({name:l.name,unit:l.unit,code:l.code,qty:l.qty,
    inQty:(l.recvQty!=null?l.recvQty:(d.status==='交接完成'?l.qty:0))}));
  const m={};(d.labels||[]).forEach(l=>{const k=l.name;if(!m[k])m[k]={name:k,unit:l.unit,code:l.code,qty:0,inQty:0};m[k].qty+=l.qty;if(l.arrived)m[k].inQty+=l.qty;});return Object.values(m);}
// 少货：实收(清点) < 应送。判责结论不对商家展示，只展示应送/实收与差异
function dvShort(d){return d.status==='交接完成'&&dvSku(d).some(r=>r.inQty<r.qty);}
function dvShortQty(d){return dvSku(d).reduce((a,r)=>a+Math.max(0,r.qty-r.inQty),0);}
// 平台补采：少货缺口由平台自营现货补货的数量（来自补货单）。未补货默认 0
function dvRepl(d){return window.FM_REPL_BY_DELIVERY?window.FM_REPL_BY_DELIVERY(d.id):[];}
function dvReplQty(d){return dvRepl(d).reduce((a,r)=>a+(+r.qty||0),0);}
function dvFine(d){return window.FM_FINE_BY_DELIVERY?window.FM_FINE_BY_DELIVERY(d.id):null;}
function dvFineAmt(d){const f=dvFine(d);return f?+(f.items.reduce((a,x)=>a+x.qty,0)*f.rate).toFixed(2):0;}
function dvReplName(d,name){return dvRepl(d).filter(r=>r.name===name).reduce((a,r)=>a+(+r.qty||0),0);}

/* ============ 送货前核货（2026-10-14，与 PC pc-modules/checkgoods.js 同口径）============
   按店铺开通（运营平台「店铺管理 › 送货前核货」，默认未开通；与 PC DB.merchant.checkMode 同一开关，App 读 CHECK_ON）。
   开通：营业截止（= 当日截单）后按送货单逐 SKU 核件数（预填实际打印数，只改装少的行，上限=min(实际打印数,应送)；2026-10-15 改，原预填应送）→ 确认核货 → 仓库才能扫码签到；签到前可撤回/修改，签到后锁定；
         应送数量变化（客户取消/改单）→ 核货失效需重核。装少了 = 少送，缺口照现有少货规则（平台补采优先），罚款按仓库实收计，主动申报不减免。
   未开通：保持现有流程，不出现任何核货入口。 */
const ckOnA=()=>typeof CHECK_ON!=='undefined'&&CHECK_ON;
const ckLocked=d=>d.signed||d.status==='交接完成';
const ckLinesA=d=>dvSku(d).map(r=>{const should=+r.qty||0,printed=ckPrintedA(d,r,should);return {key:r.name,name:r.name,code:r.code,unit:r.unit||'件',should,printed,cap:Math.min(printed,should)};});
/* 实际打印数：该送货单该 SKU 已打印的标签张数（与 PC ckPrinted 同口径：打印标签记录，补打不计）。演示无打印记录时按应送；CK_SEED_PRINTED 预置少打 */
const CK_SEED_PRINTED={};   // 演示：送货单→{商品名:打印张数}
function ckPrintedA(d,r,should){const s=CK_SEED_PRINTED[d.id]&&CK_SEED_PRINTED[d.id][r.name];if(s!=null)return s;return r.printed!=null?r.printed:should;}
const CK_SEED_SHORT={};   // 演示：可按 送货单→{商品名:核货数} 预置少送
function ckNowA(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;}
function ckSeedA(d){
  if(d._ckSeeded)return;d._ckSeeded=true;
  if(!ckLocked(d)||d.check)return;
  const lines={},snap={};ckLinesA(d).forEach(l=>{const s=CK_SEED_SHORT[d.id]&&CK_SEED_SHORT[d.id][l.key];lines[l.key]=s!=null?s:l.cap;snap[l.key]=l.should;});
  d.check={by:'merchant-sg-0125',at:`${d.deliver} 23:40`,lines,snap};
}
function ckStateA(d){            // off / none / todo / stale / done
  if(!ckOnA())return 'off';
  ckSeedA(d);
  if(!ckLinesA(d).some(l=>l.should>0))return 'off';             // 应送全为 0：无需核货（BR-02）
  if(d.check){if(ckLocked(d))return 'done';const cur=ckLinesA(d),snap=d.check.snap||{};
    return (cur.length!==Object.keys(snap).length||cur.some(l=>snap[l.key]!==l.should))?'stale':'done';}
  return ckLocked(d)?'none':'todo';                              // 已签到但无核货记录（开通前已签到 / 降级放行）=「未核货」
}
const ckBlockedA=d=>{const s=ckStateA(d);return s==='todo'||s==='stale';};
const ckShortA=d=>d.check?ckLinesA(d).reduce((a,l)=>a+Math.max(0,l.should-(d.check.lines[l.key]!=null?d.check.lines[l.key]:l.should)),0):0;
// 角标：已截单、未签到、待核货 / 需重核（BR-15）
window.FM_CK_PENDING=()=>{if(!ckOnA())return 0;if(window.FM.ensureDeliveriesFromPrint)window.FM.ensureDeliveriesFromPrint();return (window.FM.DB.deliveries||[]).filter(d=>!ckLocked(d)&&dvCutoff(d).passed&&ckBlockedA(d)).length;};
function ckChipA(d){const s=ckStateA(d);if(s==='off')return ckOnA()?stChip('无需核货','var(--muted)','var(--sub)'):'';
  const m={none:['未核货','var(--muted)','var(--sub)'],todo:['待核货','var(--amber-soft)','#B45309'],stale:['需重核','var(--red-soft)','var(--red)'],done:['已核货','var(--mint-soft)','var(--emerald-2)']}[s];return stChip(m[0],m[1],m[2]);}
/* 核货页：两种方式，同一结果（每 SKU 实装件数）
   ① 扫码核货（App 默认）：扫一张标签 = 该 SKU +1 件。去重键 = 标签二维码（序号标签每张不同）。
      - 同一张重复扫 → 不计数；别仓 / 同仓别的送货单 / 本单没有的商品 → 不计数，红色报警常驻到点「已拿下车」
      - 扫满 min(实际打印数, 应送) 后同 SKU 不再计数（超打 / 补打的标签同理）
      - 标签破损扫不出 → 行内「+」手动补录；「−」先撤回本行最近扫的一张，没扫过的才减补录
      - 修改 / 重核：保留上次已扫的标签，只有应送变少的行按新应送截掉多出的
      - 未提交离开：已扫结果按送货单存草稿，再进来自动恢复
   ② 手动核货：预填实际打印数，只改装少的行。 */
window.FM_CK_DRAFT=window.FM_CK_DRAFT||{};
const skuOfCode=c=>{const m=String(c||'').match(/(\d{4})$/);return m?'SKU'+m[1]:String(c||'');};
function ckUnits(d){   // 本送货单已打印的标签：每 SKU 序号 1..实际打印数；打满应送的另含 2 张超打（序号 > 应送）
  const u=[];ckLinesA(d).forEach(l=>{for(let i=1;i<=l.printed+(l.printed>=l.should?2:0);i++)u.push({code:`${d.pickId}|${skuOfCode(l.code)}|${d.warehouse}|${d.id}|${i}`,key:l.key,seq:i});});return u;}
function ckOpenA(d,forceEdit,mode,autoScan){
  const st=ckStateA(d);if(st==='off'||st==='none')return;
  const ro=ckLocked(d)||(st==='done'&&!forceEdit);
  if(!ro&&!dvCutoff(d).passed){toast(`未到营业截单时间（${dvCutoff(d).at}），截单后才能核货`);return;}
  const ls=ckLinesA(d).filter(l=>l.should>0);
  const draft=window.FM_CK_DRAFT[d.id];
  mode=mode||(draft&&draft.mode)||(d.check&&d.check.method)||'scan';
  // 扫码状态：codes[行]=已扫标签，adj[行]=手动补录件数
  const codes={},adj={},qty={};
  ls.forEach(l=>{codes[l.key]=[];adj[l.key]=0;});
  let restored=0;
  if(!ro&&mode==='scan'){
    const src=(draft&&draft.mode==='scan')?draft:(d.check&&d.check.method==='scan'?{codes:d.check.codes||{},adj:d.check.adj||{}}:null);
    if(src)ls.forEach(l=>{const c=(src.codes[l.key]||[]).slice(0,l.cap);codes[l.key]=c;adj[l.key]=Math.min(src.adj[l.key]||0,l.cap-c.length);});
    if(draft&&draft.mode==='scan')restored=ls.reduce((a,l)=>a+codes[l.key].length+adj[l.key],0);
  }
  const scanCnt=k=>codes[k].length;
  const calc=()=>ls.forEach(l=>{if(ro)return;if(mode==='scan')qty[l.key]=scanCnt(l.key)+adj[l.key];});
  ls.forEach(l=>{const c=d.check&&d.check.lines[l.key];
    if(ro)qty[l.key]=c!=null?c:l.should;
    else if(mode==='manual')qty[l.key]=(draft&&draft.mode==='manual'&&draft.qty[l.key]!=null)?Math.min(draft.qty[l.key],l.cap):((c!=null&&st!=='todo')?Math.min(c,l.cap):l.cap);});
  calc();
  const saveDraft=()=>{if(ro)return;const t=ls.reduce((a,l)=>a+(mode==='scan'?scanCnt(l.key)+adj[l.key]:0),0);
    if(mode==='scan'&&t===0){delete window.FM_CK_DRAFT[d.id];return;}
    window.FM_CK_DRAFT[d.id]=mode==='scan'?{mode,codes:JSON.parse(JSON.stringify(codes)),adj:{...adj}}:{mode,qty:{...qty}};};
  const allCodes=()=>new Set([].concat(...ls.map(l=>codes[l.key])));
  const tot=()=>({sh:ls.reduce((a,l)=>a+l.should,0),ck:ls.reduce((a,l)=>a+qty[l.key],0),sc:ls.reduce((a,l)=>a+scanCnt(l.key),0)});
  const sumHtml=()=>{const t=tot(),gap=t.sh-t.ck;
    if(!ro&&mode==='scan')return `已核 <b style="color:var(--ink)">${t.ck}</b> / ${t.sh} 件${gap>0?` · 还差 <b style="color:var(--red)">${gap}</b> 件`:' · <b style="color:var(--emerald)">全部扫齐</b>'}`;
    return `应送 <b>${t.sh}</b> · ${ro?'核货':'实际核货'} <b>${t.ck}</b> 件${gap>0?` · <b style="color:var(--red)">少 ${gap} 件</b>`:' · <b style="color:var(--emerald)">与应送一致</b>'}`;};
  const rowHtml=(l,i)=>{const v=qty[l.key],diff=v-l.should,sc=mode==='scan'&&!ro;
    return `<div class="ck-row${(diff<0&&!sc)?' short':''}${(sc&&diff>=0)?' full':''}" data-i="${i}">
      <div class="ck-l"><div class="ck-n">${l.name}</div>
        <div class="ck-s">${sc?`已扫 <b style="color:${diff>=0?'var(--emerald)':'var(--ink)'}">${scanCnt(l.key)}</b>${adj[l.key]?` + 补录 ${adj[l.key]}`:''} / ${l.should} ${l.unit}`:`应送 <b>${l.should}</b> ${l.unit}${ro?'':` · 实际打印 ${l.printed}`}${diff<0?` · <span style="color:var(--red);font-weight:700">少 ${-diff}</span>`:''}`}</div>
        ${sc?`<div class="ck-bar"><i style="width:${Math.min(100,Math.round(v/l.should*100))}%"></i></div>`:''}</div>
      ${ro?`<div class="ck-ro" style="${diff<0?'color:var(--red)':''}">${v}</div>`:`<div class="ck-stp${sc?' sm':''}"><button class="m" ${v<=0?'disabled':''}>−</button>${sc?`<span class="v">${v}</span>`:`<input type="number" inputmode="numeric" min="0" max="${l.cap}" value="${v}">`}<button class="p" ${v>=l.cap?'disabled':''}>+</button></div>`}
    </div>`;};
  const methodTxt=c=>c.method==='scan'?`扫码核货${c.manualAdj?`（手动补录 ${c.manualAdj} 件）`:''}`:'手动核货';
  pushPage({title:ro?'核货记录':'送货核货',subtitle:`${d.warehouse} · ${d.id}`,body:`
    <div style="padding:12px 16px 0">
      ${ro?'':`<div class="ck-seg"><div class="sg ${mode==='scan'?'on':''}" data-m="scan">扫码核货</div><div class="sg ${mode==='manual'?'on':''}" data-m="manual">手动核货</div></div>`}
      ${st==='stale'&&!ro?`<div class="ck-tip red">上次核货后<b>应送数量变了</b>（客户取消或改单），请按新的应送再核一遍${mode==='scan'?'，上次扫过的不用重扫':''}。</div>`:''}
      ${restored?`<div class="ck-tip">已恢复上次没提交的扫码结果（${restored} 件），接着扫就行。</div>`:''}
      ${ro?`<div class="ck-tip">${d.check.by} 于 ${d.check.at} ${methodTxt(d.check)}${ckShortA(d)?`，少送 <b style="color:var(--red)">${ckShortA(d)}</b> 件`:'，与应送一致'}。${ckLocked(d)?'仓库已签到，不能再改。':'仓库签到前可以修改或撤回。'}</div>`
        :mode==='scan'?`<div class="ck-scanbtn" id="ck-scan">${svg('scan')||''}<span>扫码</span><em>对着货上的标签逐件扫，扫一张记 1 件</em></div>`
        :`<div class="ck-tip">已按实际打印的标签数带出，对照车上实际装的货，数量对的不用动，只改装少的。</div>`}
      <div class="ck-list">${ls.map(rowHtml).join('')}</div>
      ${ro?'':`<div style="font-size:11.5px;color:var(--sub);line-height:1.65;margin:10px 2px 16px">少送的照现在的少货规则处理，罚款按仓库实际收到的数算。${mode==='scan'?'标签破损扫不出，点该行「+」补上。':''}</div>`}
    </div>`,
    footer:`<div style="width:100%"><div id="ck-sum" style="font-size:12.5px;color:var(--sub);text-align:center;margin-bottom:8px">${sumHtml()}</div>${ro
      ?(ckLocked(d)?`<button class="btn" style="width:100%;background:var(--muted);color:#46604F" disabled>仓库已签到</button>`:`<div style="display:flex;gap:10px"><button class="btn" id="ck-rv" style="flex:1;background:var(--red-soft);color:var(--red)">撤回核货</button><button class="btn primary" id="ck-ed" style="flex:1">修改核货</button></div>`)
      :`<button class="btn primary" style="width:100%" id="ck-ok">确认核货</button>`}</div>`,
    mount:(pg)=>{
      const sumEl=pg.querySelector('#ck-sum');
      const refreshAll=()=>{calc();ls.forEach((_,i)=>refresh(i,true));sumEl.innerHTML=sumHtml();saveDraft();};
      const refresh=(i,noSum)=>{const l=ls[i],row=pg.querySelector(`.ck-row[data-i="${i}"]`);if(!row)return;const w=document.createElement('div');w.innerHTML=rowHtml(l,i);row.replaceWith(w.firstElementChild);bindRow(i);if(!noSum){sumEl.innerHTML=sumHtml();saveDraft();}};
      const bindRow=(i)=>{const row=pg.querySelector(`.ck-row[data-i="${i}"]`);if(!row||ro)return;const l=ls[i];
        row.querySelector('.m').onclick=()=>{
          if(mode==='scan'){if(codes[l.key].length){codes[l.key].pop();toast('已撤回最近扫的一张，可重新扫');}else if(adj[l.key]>0)adj[l.key]--;else return;calc();}
          else{if(qty[l.key]<=0)return;qty[l.key]--;}refresh(i);};
        row.querySelector('.p').onclick=()=>{if(qty[l.key]>=l.cap)return;if(mode==='scan'){adj[l.key]++;calc();}else qty[l.key]++;refresh(i);};
        const ip=row.querySelector('input');
        if(ip)ip.onchange=e=>{let v=Math.floor(+e.target.value);if(isNaN(v)||v<0)v=0;if(v>l.cap){v=l.cap;toast(l.cap<l.should?`不能超过实际打印数 ${l.cap}，要多送请先去打印标签`:`不能超过应送 ${l.should}，多带的仓库照收，不用填`);}qty[l.key]=v;refresh(i);};};
      ls.forEach((_,i)=>bindRow(i));
      pg.querySelectorAll('.ck-seg .sg').forEach(b=>b.onclick=()=>{const m=b.dataset.m;if(m===mode)return;
        const t=tot();const go=()=>{delete window.FM_CK_DRAFT[d.id];popPage();setTimeout(()=>ckOpenA(d,true,m),60);};
        if(mode==='scan'&&t.ck>0)confirmDialog({title:'切换为手动核货？',body:`已扫的 ${t.ck} 件不保留，手动核货按实际打印数预填。`,okText:'切换',onOk:go});
        else if(mode==='manual'&&ls.some(l=>qty[l.key]!==l.cap))confirmDialog({title:'切换为扫码核货？',body:'手动改过的数量不保留，扫码从 0 开始计。',okText:'切换',onOk:go});
        else go();});
      /* ---------- 扫码取景（演示：模拟相机连续扫码）---------- */
      const openScanner=()=>{
        const units=ckUnits(d);
        const otherWh=(window.FM.DB.deliveries||[]).find(x=>x!==d&&x.warehouse!==d.warehouse)||{id:'SH20260701002',warehouse:'兀兰DC',pickId:d.pickId};
        const offload=[];   // 待拿下车
        const m=document.createElement('div');m.className='ck-cam';
        m.innerHTML=`<div class="top"><span class="x">✕</span><span>扫码核货 · ${d.warehouse}</span><span style="width:44px"></span></div>
          <div class="vf"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><div class="ln"></div><div class="hint">把标签二维码放进框内，自动连续识别</div></div>
          <div class="alarm" id="ck-al" style="display:none"></div>
          <div class="res" id="ck-res">准备就绪，开始扫码</div>
          <div class="tally" id="ck-tl"></div>
          <div class="demo"><div class="dm-t">🔬 演示：模拟扫到的标签</div>
            <div class="dm-b"><span data-s="next">下一件</span><span data-s="ten">连扫 10 件</span><span data-s="dup">重复扫</span><span data-s="wrong">别仓的货</span><span data-s="samewh">同仓别的送货单</span><span data-s="none">本单没有的商品</span></div></div>
          <div class="done" id="ck-done">完成，返回核货单</div>`;
        document.querySelector('.phone').appendChild(m);
        const res=m.querySelector('#ck-res'),tl=m.querySelector('#ck-tl'),al=m.querySelector('#ck-al'),dn=m.querySelector('#ck-done');
        const full=()=>ls.every(l=>qty[l.key]>=l.should);
        const paint=()=>{const t=tot();tl.innerHTML=`<b>${t.ck}</b> / ${t.sh} 件`+ls.filter(l=>qty[l.key]<l.should).slice(0,3).map(l=>`<span>${l.name} 差 ${l.should-qty[l.key]}</span>`).join('')+(offload.length?`<span class="off">待拿下车 ${offload.length} 件</span>`:'');
          dn.textContent=full()?'全部扫齐，提交核货':'完成，返回核货单';dn.classList.toggle('go',full());
          if(offload.length){al.style.display='';al.innerHTML=`<div>${offload[offload.length-1]}</div><span id="ck-off">已拿下车</span>`;al.querySelector('#ck-off').onclick=()=>{offload.pop();paint();};}else al.style.display='none';};
        const beep=ok=>{try{navigator.vibrate&&navigator.vibrate(ok?40:[80,60,80]);}catch(e){}};   // 正式实现：成功短提示音 + 震动，报警长提示音 + 双震
        const say=(ok,txt)=>{res.className='res '+(ok?'ok':'err');res.innerHTML=txt;beep(ok);};
        const alarm=txt=>{offload.push(txt);res.className='res err';res.innerHTML='不计数，见上方红色提醒';beep(false);};
        const hit=(code)=>{   // 演示协议：备货单|SKU|仓库|送货单|序号（正式以后端 manifest / resolve 为准）
          const p=String(code).split('|');
          if(p[2]!==d.warehouse)return alarm(`这件是 <b>${p[2]}</b> 的货，不是这车的，请拿下车`);
          if(p[3]!==d.id)return alarm(`这件是送货单 <b>${p[3]}</b> 的货，不是这张单的，请拿下车`);
          const u=units.find(x=>x.code===code);
          if(!u)return alarm('本送货单没有这个商品，请拿下车');
          if(allCodes().has(code))return say(false,`这张已扫过（序号 ${u.seq}），不重复计数`);
          const l=ls.find(x=>x.key===u.key);
          if(qty[l.key]>=l.cap)return say(false,`${l.name} 已扫够 ${l.cap} 件，多带的不用扫`);
          codes[l.key].push(code);calc();say(true,`✓ ${l.name} 序号 ${u.seq} · ${qty[l.key]}/${l.should}`);};
        const nextUnit=()=>{const s=allCodes();return units.find(u=>!s.has(u.code)&&qty[u.key]<ls.find(x=>x.key===u.key).cap);};
        paint();
        m.querySelectorAll('.dm-b span').forEach(b=>b.onclick=()=>{const k=b.dataset.s;
          if(k==='next'){const u=nextUnit();if(!u)say(true,'本单已全部扫齐');else hit(u.code);}
          else if(k==='ten'){for(let n=0;n<10;n++){const u=nextUnit();if(!u)break;hit(u.code);}if(!nextUnit())say(true,'本单已全部扫齐');}
          else if(k==='dup'){const c=[...allCodes()].pop();if(!c)say(false,'还没扫过标签，先扫「下一件」');else hit(c);}
          else if(k==='wrong')hit(`${d.pickId}|SKU8804|${otherWh.warehouse===d.warehouse?'兀兰DC':otherWh.warehouse}|${otherWh.id}|3`);
          else if(k==='samewh')hit(`${d.pickId}|${skuOfCode(ls[0].code)}|${d.warehouse}|SH20260702009|1`);
          else hit(`${d.pickId}|SKU9999|${d.warehouse}|${d.id}|1`);
          paint();saveDraft();});
        const close=()=>{m.remove();refreshAll();};
        m.querySelector('.x').onclick=close;
        dn.onclick=()=>{const f=full();close();if(f){const ok=pg.querySelector('#ck-ok');ok&&ok.onclick();}};
      };
      const sb=pg.querySelector('#ck-scan');if(sb)sb.onclick=openScanner;
      if(autoScan&&sb&&!restored)setTimeout(openScanner,120);   // 卡片「扫码核货」直接进相机
      const ok=pg.querySelector('#ck-ok');
      if(ok)ok.onclick=()=>{
        if(ckLocked(d)){toast('仓库已签到，不能再修改核货');return;}
        if(mode==='scan'&&tot().sc===0){toast('还没扫任何标签，先点「扫码」开始核货');return;}
        const commit=()=>{const lines={},snap={};ls.forEach(l=>{lines[l.key]=qty[l.key];snap[l.key]=l.should;});
          const manualAdj=mode==='scan'?ls.reduce((a,l)=>a+adj[l.key],0):0;
          ok.classList.add('loading');setTimeout(()=>{d.check={by:'merchant-sg-0125',at:ckNowA(),lines,snap,method:mode,manualAdj,codes:mode==='scan'?JSON.parse(JSON.stringify(codes)):null,adj:mode==='scan'?{...adj}:null};
            delete window.FM_CK_DRAFT[d.id];const g=ckShortA(d);
            toast(g?`${d.id} 已提交异常核货，少送 ${g} 件，仓库可签到收货`:`${d.id} 已核货，仓库可签到收货`);popPage();rerenderSignin();},350);};
        const gap=ls.reduce((a,l)=>a+l.should-qty[l.key],0);
        if(!gap){commit();return;}
        confirmDialog({title:mode==='scan'?`还有 ${gap} 件没扫到`:`确认少送 ${gap} 件？`,body:ls.filter(l=>qty[l.key]<l.should).map(l=>`${l.name}：应送 ${l.should}，${mode==='scan'?'已核':'实际核货'} ${qty[l.key]}`).join('<br>')+`<br><br>${mode==='scan'?'货在车上只是没扫的，返回接着扫；确实没装的，按少送提交。<br>':''}少送的照现在的少货规则处理：平台有货就替你补上（按自营原价从结算里扣），没货就不补；罚款按仓库实际收到的数算，提前报了也照罚。`,okText:'提交异常核货',onOk:commit});
      };
      const rv=pg.querySelector('#ck-rv');
      if(rv)rv.onclick=()=>confirmDialog({title:'撤回核货？',body:'撤回后要重新核货，仓库才能签到收货。',danger:1,okText:'确认撤回',onOk:()=>{delete d.check;toast('已撤回核货');popPage();rerenderSignin();}});
      const ed=pg.querySelector('#ck-ed');
      if(ed)ed.onclick=()=>{popPage();setTimeout(()=>ckOpenA(d,true),60);};
    }});
}
// 伪二维码(25x25 确定性图案)
function qrGrid(seed){let s=(seed||7)+1;const rnd=()=>{s=(s*9301+49297)%233280;return s/233280;};
  const N=25,fin=(r,c)=>{const dr=Math.min(r,N-1-r),dc=Math.min(c,N-1-c);if(r>=N-7&&c<=6)return -1;return -1;};
  let h='';for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    let on;const inFinder=(R,C)=>r>=R&&r<R+7&&c>=C&&c<C+7;
    if(inFinder(0,0)||inFinder(0,N-7)||inFinder(N-7,0)){
      const lr=(inFinder(0,0)?r:inFinder(0,N-7)?r:r-(N-7)),lc=(inFinder(0,0)?c:inFinder(0,N-7)?c-(N-7):c);
      on=(lr===0||lr===6||lc===0||lc===6||(lr>=2&&lr<=4&&lc>=2&&lc<=4));
    }else{on=rnd()>0.52;}
    h+=`<i class="${on?'b':''}"></i>`;}
  return h;}
function qrPopup(title){
  const m=document.createElement('div');m.className='dl-qrmask';
  m.innerHTML=`<div class="dl-qrpop"><div class="ph"><span class="t">${title}</span><span class="x">✕</span></div>
    <div class="qrwrap"><div class="dl-qr">${qrGrid(title.length)}</div></div>
    <div class="cap">向仓库管理人员出示二维码</div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
}

/* ============ 送货签到（数据源=FM.DB.deliveries；交接归仓库WMS，商家不可点）============ */
function dvStName(d){return {'待送货':'待送货','已预约':'已预约','已签到':'已签到','交接完成':'已入库'}[d.status]||d.status;}
function dvArrived(d){return (d.labels||[]).filter(l=>l.arrived).length;}
const DL_SLOTS=['23:00–02:00','02:00–05:00','06:00–10:00','11:00–14:00','16:00–20:00'];   // 预约送货可选时段
function stChip(t,bg,c){return `<span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${c}">${t}</span>`;}
// 送货单：预约(booked) 与 签到(signed) 相互独立
function signinCard(d){
  if(d.booked===undefined)d.booked=false;if(d.signed===undefined)d.signed=(d.status==='已签到'||d.status==='交接完成');
  const done=d.status==='交接完成';
  const bkChip=d.booked?stChip('已预约','var(--amber-soft)','var(--amber)'):stChip('未预约','var(--muted)','var(--sub)');
  const sgChip=done?stChip('已入库','var(--mint-soft)','var(--emerald-2)'):(d.signed?stChip('已签到','#E1EBFF','#2563EB'):stChip('未签到','var(--muted)','var(--sub)'));
  return `<div class="dl-card">
    <div class="dl-ch"><span>送货单</span><span class="no">${d.id}</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin:9px 0 3px;flex-wrap:wrap">${ckChipA(d)}${bkChip}${sgChip}${d.booked?`<span style="font-size:11.5px;color:var(--sub)">${d.bookWindow||d.window}</span>`:''}</div>
    <div class="dl-meta"><span class="k">备货单</span><span class="vv" style="font-family:monospace">${d.pickId}</span></div>
    <div class="dl-meta"><span class="k">入库仓库</span><span class="vv">${d.warehouse} · ${d.orderIds.length}单</span></div>
    ${d.signed&&!done?`<div class="dl-meta"><span class="k"></span><span class="vv" style="color:var(--sub)">待仓库扫码交接</span></div>`:''}
    <div class="dl-kbox"><div class="k"><div class="l">应送货(件)</div><div class="v">${dvSku(d).reduce((s,r)=>s+r.qty,0)}</div></div><div class="k"><div class="l">${done?'实收(件)':'已入库(件)'}</div><div class="v" ${dvShort(d)?'style="color:var(--red)"':''}>${dvSku(d).reduce((s,r)=>s+r.inQty,0)}</div></div><div class="k"><div class="l">平台补采(件)</div><div class="v" ${dvReplQty(d)>0?'style="color:var(--amber)"':''}>${dvReplQty(d)}</div></div></div>
    ${(()=>{const rs=dvSku(d),ov=rs.reduce((a,r)=>a+Math.max(0,r.inQty-r.qty),0);const err=whrOf(d.id).some(r=>r.type==='送错');
      return (ov||err)?`<div style="display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap">${err?stChip('有错货','var(--red-soft)','var(--red)'):''}${ov?stChip('多收 '+ov+' 件·已入寄存','var(--amber-soft)','#B45309'):''}</div>`:'';})()}
    ${done?`<div style="display:flex;align-items:center;gap:8px;margin-top:11px">${dvShort(d)
      ?stChip('收货清点 · 少货 '+dvShortQty(d)+' 件','var(--red-soft)','var(--red)')+(dvReplQty(d)>0?stChip('平台补采 '+dvReplQty(d)+' 件','var(--amber-soft)','#B45309'):'')
      :stChip('收货清点 · 足额收货','var(--mint-soft)','var(--emerald-2)')}</div>`:''}
    ${d.printed?`<div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11.5px;color:var(--emerald-2);font-weight:600">🖨️ 已打印 ${d.printedAt||''}</div>`:''}
    ${(()=>{const s=ckStateA(d);
      if((s==='todo'||s==='stale')&&!d.signed)return dvCutoff(d).passed
        ?`<div class="ck-go${s==='stale'?' red':''}" data-ck="go">${s==='stale'?'应送变了，重新核货':'扫码核货'}<span style="font-weight:500;font-size:12px;opacity:.85">· 核完仓库才能收货</span></div>`
        :`<div class="ck-go" data-ck="off" style="opacity:.42;box-shadow:none">扫码核货<span style="font-weight:500;font-size:12px;opacity:.85">· 截单后可用</span></div>`;
      if(s==='done'&&d.check)return `<div class="ck-done" data-ck="view"><span>${d.check.method==='scan'?'扫码':'手动'}核货 ${d.check.at}${ckShortA(d)?` · <b style="color:var(--red)">少送 ${ckShortA(d)} 件</b>`:''}</span><span style="color:var(--emerald);font-weight:700">${ckLocked(d)?'查看':'查看/修改'} ›</span></div>`;
      return '';})()}
    <div class="dl-acts">${done
      ?`<div class="a" data-a="detail">查看详情</div>`
      :`${dvCutoff(d).passed
          ?`<div class="a ${ckBlockedA(d)?'':'key'}" data-a="print">${d.printed?'重新打印':'打印'}</div>`
          :`<div class="a" data-a="print-off" style="opacity:.42">打印</div>`
        }${d.signed?'':`<div class="a" data-a="${d.booked?'bookmenu':'book'}">${d.booked?'改约/取消':'预约送货'}</div><div class="a" data-a="sign">签到码</div>`}<div class="a" data-a="detail">详情</div>`}</div>
  </div>`;
}
/* ============================================================
   送货单打印（截单后可打印，打印纸含签到二维码）—— 与 PC pc-modules/delivery.js 同源同口径
   截单口径：送货单内容在【营业截单】后才固定，截单前客户仍可下单/改单，故截单前禁用打印。
   截单时刻 = 送达日【前一日】的营业截止时间（即当日截单时间）。
   营业时间由商家在【PC 端 › 店铺管理 › 营业管理】维护（PC DB.bizCfg）；App 端只读，此处内置同值副本。
============================================================ */
const BIZ_WEEK={'周一':'15:00','周二':'15:00','周三':'15:00','周四':'15:00','周五':'15:00','周六':'12:00','周日':''};
const PLATFORM_CUTOFF='18:00';
const WD=['周日','周一','周二','周三','周四','周五','周六'];
function prevBizDay(mmdd){
  if(!mmdd)return null;
  const m=String(mmdd).match(/(\d{1,2})-(\d{1,2})/); if(!m)return null;
  const dt=new Date(2026,+m[1]-1,+m[2]); dt.setDate(dt.getDate()-1);
  const pad=n=>String(n).padStart(2,'0');
  return {date:pad(dt.getMonth()+1)+'-'+pad(dt.getDate()), wd:WD[dt.getDay()], js:dt};
}
function dvCutoff(d){
  const prev=prevBizDay(d.deliver);
  let end=PLATFORM_CUTOFF, wd='';
  if(prev){wd=prev.wd; const e=BIZ_WEEK[wd]; if(e)end=e;}
  const at=prev?`${prev.date} ${end}`:'—';
  if(window.FM.DB.delivDemoPreCutoff)return {at,wd,end,passed:false};
  let passed=true;
  if(prev){const [hh,mm]=end.split(':').map(Number);const c=new Date(prev.js);c.setHours(hh||0,mm||0,0,0);passed=Date.now()>=c.getTime();}
  return {at,wd,end,passed};
}
// 打印纸商品明细：复用既有 dvSku(d)（已覆盖 demoLines 与 labels 两种来源）。
// ⚠️ 不要单独从 d.labels 聚合：部分单的 labels 只是标签张数占位，无商品名/数量。
function dvPrint(d){
  const cf=dvCutoff(d);
  if(!cf.passed){toast(`未到营业截单时间（${cf.at}），送货单内容可能还会变动，暂不可打印`);return;}
  const items=dvSku(d), totalQty=items.reduce((a,x)=>a+(+x.qty||0),0);
  // dvSku 的 code 是【标签码】(LBL-<订单后5位>-<SKU后4位>)，打印纸要的是 SKU 编码，与 PC 保持一致
  const skuOf=x=>{const m=String(x.code||'').match(/(\d{4})$/);return m?('SKU'+m[1]):(x.code||'—');};
  const now=new Date(),pad=n=>String(n).padStart(2,'0');
  const printedAt=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const row=(k,v)=>`<div style="display:flex;padding:6px 0;border-bottom:1px solid #EEE;font-size:12.5px"><span style="width:82px;color:#666;flex:0 0 82px">${k}</span><span style="font-weight:600;color:#111">${v}</span></div>`;
  pushPage({title:'打印送货单',body:`
    <div style="padding:14px 16px 20px">
      <div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:var(--sh-sm);color:#111">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px">
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">Food Max 送货单</div>
            <div style="font-size:10px;color:#666;letter-spacing:1px;margin-top:2px">DELIVERY NOTE</div>
            <div style="font-size:14px;font-weight:700;margin-top:8px;font-family:monospace;word-break:break-all">${d.id}</div>
          </div>
          <div style="text-align:center;flex:0 0 auto;margin-left:10px">
            <div class="dl-qr" style="width:96px;height:96px">${qrGrid((d.id||'').length+3)}</div>
            <div style="font-size:10px;font-weight:700;margin-top:5px">送货签到码</div>
          </div>
        </div>
        ${row('商家','鲜丰食材 Fresh Harvest')}
        ${row('入库仓库',d.warehouse)}
        ${row('营业截单',`${cf.at}${cf.wd?`（${cf.wd}）`:''} · 已截单`)}
        <div style="font-size:12.5px;font-weight:700;margin:16px 0 6px">商品明细</div>
        <table style="width:100%;font-size:11.5px;border-collapse:collapse">
          <thead><tr style="background:#F3F4F6">
            <th style="text-align:left;padding:5px 6px;border:1px solid #ddd">SKU 编码</th>
            <th style="text-align:left;padding:5px 6px;border:1px solid #ddd">商品名称</th>
            <th style="text-align:right;padding:5px 6px;border:1px solid #ddd;width:76px">送货数量</th>
          </tr></thead>
          <tbody>${items.length?items.map(x=>`<tr>
            <td style="padding:5px 6px;border:1px solid #ddd;font-family:monospace">${skuOf(x)}</td>
            <td style="padding:5px 6px;border:1px solid #ddd">${x.name||'—'}</td>
            <td style="padding:5px 6px;border:1px solid #ddd;text-align:right"><b>${x.qty}</b> ${x.unit||'件'}</td>
          </tr>`).join(''):`<tr><td colspan="3" style="padding:12px;border:1px solid #ddd;text-align:center;color:#888">暂无商品明细</td></tr>`}
          <tr style="background:#FAFAFA;font-weight:700"><td colspan="2" style="padding:5px 6px;border:1px solid #ddd">合计</td><td style="padding:5px 6px;border:1px solid #ddd;text-align:right">${totalQty}</td></tr>
          </tbody>
        </table>
        <div style="display:flex;gap:14px;margin-top:20px;font-size:11px;color:#333">
          <div style="flex:1;border-top:1px solid #999;padding-top:5px">送货人签字</div>
          <div style="flex:1;border-top:1px solid #999;padding-top:5px">仓库收货签字</div>
        </div>
        <div style="margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:7px">打印时间 ${printedAt}　|　到仓出示本单由仓库扫码签到</div>
      </div>
    </div>`,
    footer:`<button class="btn primary" style="width:100%" id="dl-doprint">🖨️ 打印</button>`,
    mount:(pg)=>{pg.querySelector('#dl-doprint').onclick=()=>{
      d.printed=true; d.printedAt=printedAt.slice(5);
      toast('送货单已打印（含签到二维码）'); popPage(); rerenderSignin();};}
  });
}
function dvBookSheet(d){sheet(DL_SLOTS.map(s=>({label:`预约 ${s}${(d.bookWindow||d.window)===s?'　✓':''}`,onClick:()=>{d.booked=true;d.bookWindow=s;toast('已预约送货 '+s);rerenderSignin();}})));}
// 签到码：商家出示，由【仓库人员扫码确认】，商家端不做签到确认操作（演示用"模拟仓库扫码"）
function dvSignQR(d){const m=document.createElement('div');m.className='modal-mask';
  m.innerHTML=`<div class="modal" style="max-width:320px"><div class="mt">送货签到码 · ${d.warehouse}</div>
    <div class="mb"><div style="background:var(--mint-soft);border-radius:14px;padding:16px 12px;text-align:center"><div style="font-weight:700;margin-bottom:10px">${d.id}</div><div class="dl-qr">${qrGrid((d.id||'').length+3)}</div><div style="font-size:11.5px;color:var(--sub);margin-top:10px;line-height:1.6">到仓<b>出示此码</b>，由<b>仓库人员扫码确认签到</b>——商家端不做签到操作。</div></div>${ckBlockedA(d)?`<div style="margin-top:10px;background:var(--red-soft);color:var(--red);font-size:12px;line-height:1.55;padding:10px 12px;border-radius:12px">本单<b>${ckStateA(d)==='stale'?'核货已失效':'还没核货'}</b>，仓库扫码会被拦截，请先核货。</div>`:''}</div>
    <div class="mf"><div class="mbn cancel">关闭</div><div class="mbn ok">🔬 模拟仓库扫码签到</div></div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.cancel').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
  m.querySelector('.ok').onclick=()=>{
    if(ckBlockedA(d)){m.remove();confirmDialog({title:'签到被拦截',body:`仓库扫码结果：<b>${ckStateA(d)==='stale'?'应送数量变了，要重新核货':'商家还没核货'}</b>，暂不能签到收货。请打开 App「送货签到」核货，核完仓库再扫码。`,okText:'去核货',onOk:()=>ckOpenA(d)});return;}
    d.signed=true;d.signTime=d.signTime||'00:12';m.remove();toast('仓库已扫码确认签到，待逐张核验交接入仓');rerenderSignin();};}
function bindSignin(el,d){
  el.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>{const k=b.dataset.ck;if(k==='off'){toast(`未到营业截单时间（${dvCutoff(d).at}），截单后才能核货`);return;}ckOpenA(d,k==='go',null,k==='go');});
  el.querySelectorAll('.dl-acts .a').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    // 签到与预约相互独立；签到由仓库扫码确认，商家端只出示签到码
    if(a==='print')dvPrint(d);
    else if(a==='print-off'){const cf=dvCutoff(d);toast(`未到营业截单时间（${cf.at}${cf.wd?' '+cf.wd:''}），截单后送货单内容才固定，届时可打印`);}
    else if(a==='sign')dvSignQR(d);
    else if(a==='book')dvBookSheet(d);
    else if(a==='bookmenu')sheet([{label:'改约时段',onClick:()=>dvBookSheet(d)},{label:'取消预约',danger:1,onClick:()=>{d.booked=false;d.bookWindow='';toast('已取消预约，仍可到仓直接签到');rerenderSignin();}}]);
    else if(a==='detail')openSignDetail(d);
  });
}
let _signList=null;
function rerenderSignin(){if(_signList)renderSigninInto(_signList);}
function renderSigninInto(list){
  const DL=window.FM.DB.deliveries||[];
  list.innerHTML=skel(2);
  setTimeout(()=>{
    if(!DL.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('sign')}</div><h4>暂无送货单</h4><p>电脑端打印首个标签后，系统按入库仓库自动生成送货单</p></div>`;return;}
    list.innerHTML='';
    DL.forEach(d=>{const w=document.createElement('div');w.innerHTML=signinCard(d);const c=w.firstElementChild;list.appendChild(c);bindSignin(c,d);});
  },420);
}
function openSignin(){
  if(window.FM.ensureDeliveriesFromPrint)window.FM.ensureDeliveriesFromPrint(); // 电脑端打印首标签→自动生成送货单(演示)
  if(!window.FM.DB._delivDemo){window.FM.DB._delivDemo=true;const DL=window.FM.DB.deliveries||[];   // 演示预约/签到解耦的各种态
    if(DL[0]){DL[0].booked=true;DL[0].bookWindow='23:00–02:00';}          // 已预约·未签到
    if(DL[1]){DL[1].signed=true;DL[1].signTime='00:12';}                  // 未预约·已签到(仓库已扫码)
    // 已入库并完成收货清点·少货：缺口由平台自营现货补货，对应「平台补采」的补货单（与 PC 同数据）
    DL.push(
      {id:'SH20260628004',pickId:'JH20260628004',warehouse:'盛港DC',deliver:'06-28',window:'02:00–05:00',orderIds:['#SG20260628011'],labels:[],should:20,
       status:'交接完成',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'00:52',receiptTime:'2026-06-28 01:06',
       demoLines:[{code:'LBL-x-8801',name:'小棠菜',unit:'件',qty:20,recvQty:18}]},
      {id:'SH20260629005',pickId:'JH20260629005',warehouse:'兀兰DC',deliver:'06-29',window:'02:00–05:00',orderIds:['#SG20260629004'],labels:[],should:30,
       status:'交接完成',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'02:41',receiptTime:'2026-06-29 03:24',
       demoLines:[{code:'LBL-x-8804',name:'空心菜',unit:'件',qty:30,recvQty:34}]}   // 多收 4：商家多送，仓库照收入寄存（BR-16c）
    );}
  pushPage({title:'送货签到',body:`
    <div class="dl-banner"><span>送货单由<b>电脑端打印首个标签</b>时按入库仓库自动生成（移动端不打印标签）。<b>预约与签到相互独立</b>；签到由<b>仓库扫码</b>核验交接入仓。${ckOnA()?'<br><b>送货前先核货</b>：营业截止（截单）后才能开始核货，对照车上的货逐个 SKU 核数量（按实际打印数带出），核完仓库才能扫码签到。':''}</span></div>
    <div class="dl-list" id="dl-sgl"></div>`,
    mount:(p)=>{
      _signList=p.querySelector('#dl-sgl');renderSigninInto(_signList);
    }});
}

/* ============ 送货单详情（条码逐张 + 交接由仓库WMS，演示占位）============ */
function openSignDetail(d){
  const meta=RECV[d.warehouse]||{};
  const kv=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--sub);flex-shrink:0">${k}</span><span style="text-align:right;font-weight:500;word-break:break-all">${v||'—'}</span></div>`;
  const sec=t=>`<div style="margin:16px 16px 6px;font-weight:700;font-size:14px">${t}</div>`;
  const box=inner=>`<div style="margin:0 16px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:12px;padding:2px 14px">${inner}</div>`;
  const skuFrom=c=>'SKU'+String(c||'').split('-').pop();
  const rows=dvSku(d);const totQty=rows.reduce((s,r)=>s+r.qty,0),totIn=rows.reduce((s,r)=>s+r.inQty,0);
  const signed=d.signed||d.status==='交接完成';
  pushPage({title:'送货单详情',navbar:true,body:`
    ${sec('单据信息')}
    ${box(
      kv('送货单号',`<span style="font-family:monospace">${d.id}</span>`)+
      kv('来源单号(备货单)',`<span style="font-family:monospace">${d.pickId||'-'}</span>`)+
      kv('入库仓库',d.warehouse)+
      kv('送达时段',`${d.deliver} ${d.window||''}`)+
      kv('应送货',`${totQty} 件`)+
      (ckStateA(d)!=='off'?kv('核货',d.check?`${d.check.method==='scan'?'扫码':'手动'}核货 ${d.check.at}${ckShortA(d)?` · <b style="color:var(--red)">少送 ${ckShortA(d)} 件</b>`:' · 与应送一致'}`:`<b style="color:${ckStateA(d)==='none'?'var(--sub)':'#B45309'}">${{stale:'需重核',none:'未核货',todo:'待核货'}[ckStateA(d)]}</b>`):'')+
      kv('实收数量（收货清点）',d.status==='交接完成'?`<b style="color:${totIn<totQty?'var(--red)':(totIn>totQty?'var(--amber)':'var(--emerald)')}">${totIn}</b> 件${totIn<totQty?`（短收 ${totQty-totIn} 件）`:''}${totIn>totQty?`（多收 ${totIn-totQty} 件 · 已入寄存）`:''}`:'待清点')+
      kv('预约时间',d.booked?`${d.deliver} ${d.bookWindow||d.window}`:'未预约')+
      kv('签到时间',signed?`${d.signTime||'00:12'} 仓库扫码确认`:'未签到')+
      kv('交接时间',d.status==='交接完成'?`${d.deliver} 已交接入仓`:'未交接')+
      kv('收货清点时间',d.status==='交接完成'?`${d.receiptTime||d.deliver+' 已清点'}（出库前·仓内清点）`:'未清点')+
      kv('收货结果',d.status==='交接完成'?(dvShort(d)?`<b style="color:var(--red)">少货 ${dvShortQty(d)} 件</b>`:'<b style="color:var(--emerald)">足额收货</b>'):'待清点')+
      kv('缺货罚款',d.status==='交接完成'?(dvFineAmt(d)>0?`<b style="color:var(--red)">S$${dvFineAmt(d).toFixed(2)}</b>（${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × S$${dvFine(d).rate.toFixed(2)}/件 · ${dvFine(d).no}）`:'无'):'—')+
      kv('平台补采',d.status==='交接完成'?`<b style="color:${dvReplQty(d)>0?'var(--amber)':'var(--sub)'}">${dvReplQty(d)}</b> 件${dvReplQty(d)>0?'（缺口由平台自营现货补货）':'（无需补货）'}`:'0 件')
    )}
    ${dvShort(d)?(()=>{const rs=(window.FM_REPL_BY_DELIVERY?window.FM_REPL_BY_DELIVERY(d.id):[]);
      return `<div style="margin:12px 16px 0;background:${rs.length?'var(--amber-soft)':'var(--red-soft)'};color:${rs.length?'#B45309':'var(--red)'};font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
        本单收货清点<b>少货 ${totQty-totIn} 件</b>。${rs.length
          ?`缺口已由平台<b>自营现货全额补齐</b>，客户订单未受影响（商品/金额/发票不变），已生成平台补采单 ${rs.map(r=>r.no).join('、')}——按<b>你的含税售价 ×(1+加价率)</b> 计价并在结算单中抵扣。<div id="dl-repl-lk" style="font-weight:700;margin-top:6px;min-height:32px;display:flex;align-items:center;cursor:pointer">查看平台补采单 ›</div>`
          :`自营现货不足以全额覆盖缺口，本单按<b>实收数量</b>出库并标缺货，不生成平台补采单。`}
        ${dvFineAmt(d)>0?`<div style="margin-top:6px">另按缺货计<b>罚款 S$${dvFineAmt(d).toFixed(2)}</b>（${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × S$${dvFine(d).rate.toFixed(2)}/件，单号 ${dvFine(d).no}）——<b>罚款与是否补采无关，只要清点出缺口就计</b>。</div>`:''}
        <div style="color:var(--sub);margin-top:4px">对实收数量有异议请<b>线下联系平台运营</b>核对，本期不设线上申诉入口。</div>
      </div>`;})():''}
    ${(ADDR[d.warehouse]||meta.d)?sec('交货地点信息')+box(
      kv('入库仓库',d.warehouse)+
      kv('详细地址',ADDR[d.warehouse])+
      kv('送货联系人',meta.d?String(meta.d).split(' ')[0]:'')+
      kv('联系电话',meta.d?(String(meta.d).split(' ')[1]||''):'')
    ):''}
    <div class="dl-kbox" style="margin:0 16px"><div class="k"><div class="l">应送货(件)</div><div class="v">${totQty}</div></div><div class="k"><div class="l">${d.status==='交接完成'?'实收(件)':'已入库(件)'}</div><div class="v" ${totIn<totQty?'style="color:var(--red)"':''}>${totIn}</div></div><div class="k"><div class="l">平台补采(件)</div><div class="v" ${dvReplQty(d)>0?'style="color:var(--amber)"':''}>${dvReplQty(d)}</div></div></div>
    ${whrOf(d.id).length?sec('错货 · 待退回')+box(
      `<div style="padding:9px 0;font-size:12.5px;color:#B45309">本单被清点出 <b>${(function(l){return [...new Set(l.map(x=>x.type))].map(t=>`${t} ${l.filter(x=>x.type===t).reduce((a,x)=>a+x.qty,0)}${l.find(x=>x.type===t).unit}`).join(' · ');})(whrOf(d.id))}</b>，仓库已登记台账并留存照片，请线下取回；<b>不计入结算</b>。</div>`+
      whrOf(d.id).map(r=>`<div style="padding:9px 0;border-top:1px solid rgba(0,0,0,.05)">
        <div style="display:flex;align-items:center;gap:8px"><b>${r.name}</b>${stChip(r.type,r.type==='送错'?'var(--red-soft)':'var(--amber-soft)',r.type==='送错'?'var(--red)':'#B45309')}${r.status==='已取回'?stChip('已取回','var(--mint-soft)','var(--emerald-2)'):stChip('待取回','#E1EBFF','#2563EB')}</div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.skuCode} · ${r.spec} · ${r.qty}${r.unit} · 库位 ${r.slot}</div>
      </div>`).join('')+
      `<div id="dl-whr-go" style="padding:11px 0;color:var(--emerald);font-weight:700;font-size:13px;min-height:44px;display:flex;align-items:center;cursor:pointer;border-top:1px solid rgba(0,0,0,.05)">前往「退货单 › 仓库退回」查看明细与照片 ›</div>`
    ):''}
    ${sec('商品明细 · 按 SKU 件数')}
    ${box(
      rows.map(r=>`<div style="padding:9px 0;border-bottom:1px solid rgba(0,0,0,.05)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600">${r.name} <span style="font-family:monospace;font-size:11px;color:var(--sub)">${skuFrom(r.code)}</span></span><span style="font-family:'Lora',serif">${r.qty}${r.unit}</span></div><div style="font-size:11.5px;color:var(--sub);margin-top:2px">下单/预约 ${r.qty}${r.unit}${(ckStateA(d)!=='off'&&d.check&&d.check.lines[r.name]!=null)?` · 核货 <b style="color:${d.check.lines[r.name]<r.qty?'var(--red)':'inherit'}">${d.check.lines[r.name]}${r.unit}</b>`:''} · ${d.status==='交接完成'?'实收':'已入库'} <b style="color:${r.inQty>=r.qty?'var(--emerald)':'var(--red)'}">${r.inQty}${r.unit}</b>${r.inQty<r.qty?` · 差异 <b style="color:var(--red)">-${r.qty-r.inQty}</b>`:''}${r.inQty>r.qty?` · 差异 <b style="color:var(--amber)">+${r.inQty-r.qty}</b>（多收·已入寄存）`:''} · 平台补采 <b style="color:${dvReplName(d,r.name)>0?'var(--amber)':'var(--sub)'}">${dvReplName(d,r.name)}</b>${r.unit}</div></div>`).join('')||'<div style="padding:12px 0;color:var(--sub);text-align:center">无商品明细</div>'
    )}
    <div style="margin:8px 16px 0;font-size:11.5px;color:var(--sub);line-height:1.6">实收数量由仓库<b>收货清点</b>后由 WMS 实时回写，商家端只读。少货部分<b>不冲减客户订单</b>，也不下调你的 GMV 与佣金。<b>平台补采</b>＝缺口由平台自营现货补货的数量（未补货为 0），按含税售价 ×(1+加价率) 在结算单中抵扣。<br><b>多收</b>：你送的比应送多，仓库<b>照收不设上限</b>，超出部分计入<b>在仓寄存库存</b>，<b>当天不参与售卖</b>、不结算，次日优先抵扣应送量。送来应送清单外的 SKU 属<b>送错</b>，仍需线下取回。</div>
    <div style="height:8px"></div>`,
    footer:`${(d.signed&&d.status!=='交接完成')?`<button class="btn" style="width:100%;background:var(--muted);color:#46604F" id="dl-wms">🔬 演示：模拟仓库扫码交接</button>`:`<button class="btn primary" style="width:100%" disabled>${d.status==='交接完成'?'已交接入仓':'待仓库交接'}</button>`}`,
    mount:(p)=>{
      const wgo=p.querySelector('#dl-whr-go');
      if(wgo)wgo.onclick=()=>{popPage();window.FM_MOD&&window.FM_MOD.return?window.FM_MOD.return():toast('退货单模块加载中');};
      const rlk=p.querySelector('#dl-repl-lk');
      if(rlk)rlk.onclick=()=>{window.FM_MOD&&window.FM_MOD.replen?window.FM_MOD.replen():toast('平台补采模块加载中');};
      const wms=p.querySelector('#dl-wms');
      if(wms)wms.onclick=()=>confirmDialog({title:'模拟仓库扫码交接',body:`【演示】模拟仓库 WMS 扫齐 ${d.should} 张标签，${d.orderIds.length} 个订单将转「备货中」。真实由仓库端扫码，商家不操作。`,okText:'模拟交接',onOk:()=>{(d.labels||[]).forEach(l=>l.arrived=true);window.FM.deliveryHandover(d.id);toast('【演示】已交接入仓，订单转备货中');popPage();rerenderSignin();}});
    }});
}

/* ============ 交货进度 ============ */
const PROG=[
 {dept:'新加坡事业部',total:1104,whs:[
   {n:'裕廊DC',time:'06-30 23:00-02:00',type:'recv',should:33,recv:0,wait:33,batch:'早批次10',undeliv:'未送货33件'},
   {n:'兀兰DC（配送商）',time:'06-30 23:00-02:00',type:'print',should:5,print:5,deliv:0,wait:5,batch:'早批次3',undeliv:'未送货5件'},
   {n:'盛港DC（代理人）',time:'06-30 23:00-02:00',type:'print',should:3,print:3,deliv:0,wait:3,batch:'早批次0',undeliv:'未送货3件'},
 ]},
];
const STATIONS=[['中区站',12,12,0],['东区站',11,11,0],['西区站',7,7,0],['北区站',3,3,0]];
function progWh(w){
  const mx=w.type==='recv'
    ? `<div class="m"><div class="v">${w.should}</div><div class="l">应送货</div></div><div class="m"><div class="v">${w.recv}</div><div class="l">已收货</div></div><div class="m"><div class="v wait">${w.wait}</div><div class="l">待交货</div></div>`
    : `<div class="m"><div class="v">${w.should}</div><div class="l">应送货</div></div><div class="m"><div class="v">${w.print}</div><div class="l">已打印</div></div><div class="m"><div class="v">${w.deliv}</div><div class="l">已交货</div></div><div class="m"><div class="v wait">${w.wait}</div><div class="l">待交货</div></div>`;
  return `<div class="dl-pw"><div class="wn"><span>${w.n} ⑦</span><span class="tm">交货时间 ${w.time}</span></div>
    <div class="mx">${mx}</div>
    <div class="sub2"><span class="bt">${w.batch} ⑦</span><span class="ud">${w.undeliv}</span></div>
    <div class="pacts"><div class="b" data-st="${w.n}">站区明细</div><div class="b" data-ar="${w.n}">片区明细</div></div></div>`;
}
function openProgress(){
  pushPage({title:'交货进度',body:`
    <div class="dl-filters"><span class="dl-drop" data-f="date">07月01日 <span class="ca">▾</span></span><span class="dl-drop" data-f="city">全部管理城市 <span class="ca">▾</span></span><span class="dl-drop" data-f="ware">全部仓库 <span class="ca">▾</span></span></div>
    <div id="dl-pgbody"></div>`,
    mount:(p)=>{
      const body=p.querySelector('#dl-pgbody');
      const draw=()=>{
        body.innerHTML=skel(2);
        setTimeout(()=>{
          body.innerHTML=`<div class="dl-glabel">交货进度</div>`+PROG.map(g=>`<div class="dl-pcard">
            <div class="dept"><span class="nm">${g.dept}</span><span class="tot">总销量 ${g.total}</span></div>
            ${g.whs.map(progWh).join('')}</div>`).join('');
          body.querySelectorAll('[data-st]').forEach(e=>e.onclick=()=>stationPopup(e.dataset.st,'站区'));
          body.querySelectorAll('[data-ar]').forEach(e=>e.onclick=()=>stationPopup(e.dataset.ar,'片区'));
        },420);
      };
      draw();
      p.querySelectorAll('.dl-drop').forEach(d=>d.onclick=()=>sheet([{label:'全部',onClick:()=>toast('已筛选')},{label:'裕廊DC',onClick:()=>toast('已筛选')}]));
    }});
}
function stationPopup(ware,kind){
  const m=document.createElement('div');m.className='dl-sheet-mask';
  m.innerHTML=`<div class="dl-sheet"><div class="sh">${ware} · ${kind}明细<span class="x">✕</span></div>
    <div class="sbody"><div class="dl-tbl"><div class="th"><span class="c1">${kind}名称</span><span class="c2">应送货</span><span class="c2">已打印</span><span class="c2">已交货</span></div>
    ${STATIONS.map(s=>`<div class="tr"><span class="c1">${s[0]}</span><span class="c2">${s[1]}</span><span class="c2">${s[2]}</span><span class="c2">${s[3]}</span></div>`).join('')}</div></div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
}

/* ============ 退货取回 → 退货单（2026-07-21 会议定稿：商家只读；确认由仓库操作。2026-10-14：线上无逾期规则，删除 72h 提货时限 / 逾期未提） ============ */
// 退货单：三方退货到平台仓不入库仅暂存。状态 待仓库入库→待提货(仓库确认到货)→已提货；货物在仓暂存至商家提走。
// 商家端只读展示状态+提货码，无状态确认/预约/新建权限（三方退款须基于已判责售后工单，禁止商家自建）
// items：retQty=审核通过退款数量（退回数量）；pickQty=WMS 累计出库数量（取回数量），提货前为 null；price=正向订单该行结算单价（退货金额与申诉赔付共用，按正向订单结算同口径：实付+平台补贴−抽佣）
// 口径与 PC scm_商家管理系统_全流程_交互原型.html 的 retQtySum/pickQtyVal/retAppealWin 一致
// 相对当前时刻偏移 h 小时（演示数据用，保证申诉窗口在演示时可用）
function relTs(h){const d=new Date(Date.now()+h*3600000);const p=n=>(''+n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());}
function nowTs(){return relTs(0);}
const RETURN=[
 {no:'TKD2026063008266685',orderNo:'#SG20260630685',ware:'裕廊DC',st:'待提货',order:'2026-07-20 08:51',gen:'2026-07-20 08:51',code:'460439',arrive:'2026-07-20 21:00',pickup:'',
  items:[{name:'芥蓝',sku:'SKU8813',spec:'10kg/件',unit:'件',retQty:1,pickQty:null,price:32.50}]},
 {no:'TKD2026062908267496',orderNo:'#SG20260629496',ware:'兀兰DC',st:'待仓库入库',order:relTs(-60),gen:relTs(-60),code:'897256',arrive:'',pickup:'',
  items:[{name:'娃娃菜',sku:'SKU8812',spec:'15kg/件',unit:'件',retQty:1,pickQty:null,price:105.00}]},
 {no:'TKD2026062908314280',orderNo:'#SG20260629280',ware:'盛港DC',st:'待提货',order:'2026-07-20 06:04',gen:'2026-07-20 06:04',code:'715187',arrive:'2026-07-20 14:00',pickup:'',
  items:[{name:'上海青',sku:'SKU8806',spec:'1kg/件',unit:'件',retQty:4,pickQty:2,price:5.80}]},
 {no:'TKD2026062708201337',orderNo:'#SG20260627337',ware:'大巴窑DC',st:'已提货',order:relTs(-40),gen:relTs(-40),code:'330218',arrive:relTs(-26),pickup:relTs(-5),
  items:[{name:'西兰花',sku:'SKU8861',spec:'5kg/件',unit:'件',retQty:3,pickQty:3,price:20.00},{name:'番茄',sku:'SKU8862',spec:'5kg/箱',unit:'箱',retQty:2,pickQty:1,price:18.00}]},
 {no:'TKD2026062508198820',orderNo:'#SG20260625820',ware:'裕廊DC',st:'已提货',order:relTs(-50),gen:relTs(-50),code:'118904',arrive:relTs(-30),pickup:relTs(-3),
  items:[{name:'芥蓝',sku:'SKU8813',spec:'12kg/件',unit:'件',retQty:1,pickQty:1,price:78.00}]},
 {no:'TKD2026061808190012',orderNo:'#SG20260618012',ware:'淡滨尼DC',st:'已提货',order:'2026-06-16 09:10',gen:'2026-06-16 09:10',code:'552301',arrive:'2026-06-16 20:00',pickup:'2026-06-17 10:20',
  items:[{name:'番茄',sku:'SKU8862',spec:'5kg/箱',unit:'箱',retQty:4,pickQty:2,price:18.00}],
  appeal:{kind:'goods',status:'部分成立',at:'2026-06-17 15:02',reviewAt:'2026-06-18 11:30',desc:'仓库只找到 2 箱，另 2 箱未见',photos:0,compStatus:'已生成',
    items:[{name:'番茄',ret:4,sysPick:2,actual:2,damaged:0,short:2,qty:2,price:18.00,ok:1}],comp:18.00,compNo:'RC-20260618-317',note:'监控确认仓库少出 1 箱；另 1 箱客户退回时已缺失，不予赔付'}},
];
const retSum=g=>g.items.reduce((s,x)=>s+x.retQty,0);
// 取回数量 = 各 SKU WMS 累计出库数量（可分次取）；SKU 无出库记录 = null，退货单进入 已提货 时补 0；
// 单 SKU null 显示「—」；合计全 null 显示「—」、否则 null 按 0 计。纯展示不标色（与 PC 同口径）
const pickOf=(g,x)=>(x.pickQty==null&&g.st==='已提货')?0:x.pickQty;
/* 退货单申诉（scm_退货申诉_prd.md，与 PC retAppealWin / raModal 同口径）：只管退回的实物，不改原售后判责
   2026-10-27：所有状态都能申诉（已取消除外），不设时间窗口
   · 实物问题（待提货 / 已提货 / 逾期未提(存量)；仓库退回待取回 / 已取回）：按 SKU 填「实际数量」（默认=系统记录：已提货/已取回取取回数，
     在仓取退回数）和「其中坏了不能卖」（默认 0），申诉数量 = (退回 − 实际数量) + 损坏，系统算；有损坏时照片必填
   · 未到仓（待仓库入库）：申诉数量默认 = 退回数量
   · 其他：申诉数量全为 0 但说明写了问题 → 按「其他」提交，平台核定数量（上限 = 退回数量）
   · 每张退货单 / 每条退回记录 1 次；平台 48h 内给结果
   · 赔付 = Σ 核定数量 × 单价（客户退货=原订单结算单价，仓库退回=商品售价，不扣佣金），生成赔付单直接推送进结算单（货权转移阶段，随结算单开票）
   · 10-27 会议：客服核实；仓库退回申诉入口默认关闭（FM.DB.whrAppealOn，与 PC 同） */
const RA_KIND={goods:'实物问题',noarrive:'未到仓'};
const RA_REVIEW_H=48;
const raKindLabel=a=>a.other?'其他':RA_KIND[a.kind];
// 系统记录数：已提货 / 已取回 → 系统取回数；还在仓里 → 退回数量
const raSys=(g,x)=>(g._whr?x._picked:g.st==='已提货')?(x.pickQty||0):x.retQty;
const RA_TONE={'平台处理中':['#E8F0FE','#2563EB'],'成立':['var(--mint-soft)','var(--emerald-2)'],'部分成立':['var(--amber-soft)','#B45309'],'不成立':['var(--muted)','var(--sub)']};
const msTs=ms=>relTs((ms-Date.now())/3600000);
const tsMs=v=>{const t=v?Date.parse(String(v).replace(' ','T')):NaN;return isNaN(t)?0:t;};
const fmtS=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const r2=n=>Math.round((+n||0)*100)/100;
function raWin(g){
  if(g.appeal)return null;
  if(g._whr&&!window.FM.DB.whrAppealOn)return null;   // 仓库退回申诉入口默认关闭
  if(g.st==='待仓库入库')return {kind:'noarrive'};
  if(['待提货','已提货','逾期未提'].includes(g.st))return {kind:'goods'};
  return null;   // 已取消等：不开放
}
function raOpen(g){return !!raWin(g);}
function raTag(st){const c=RA_TONE[st]||RA_TONE['不成立'];return `<span style="display:inline-block;background:${c[0]};color:${c[1]};font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px">${st==='平台处理中'?'退货申诉·平台处理中':'退货申诉'+st}</span>`;}
// 卡片/详情上的申诉状态一行
function raLine(g){
  if(g.appeal)return raTag(g.appeal.status);
  return raWin(g)?`<span style="color:var(--emerald-2)">可申诉</span>`:'';
}
function pickVal(g,x){
  const vals=(x?[x]:g.items).map(i=>pickOf(g,i));
  return vals.every(v=>v==null)?null:vals.reduce((s,v)=>s+(v||0),0);
}
// 退货金额：关联正向订单，按正向订单结算单价 × 退回数量（按行四舍五入再求和），与 PC retAmt 同口径
const retAmt=g=>+g.items.reduce((s,x)=>s+(x.price==null?0:Math.round(x.retQty*x.price*100)/100),0).toFixed(2);
function pickHtml(g,x){const v=pickVal(g,x);return v==null?'<span style="color:var(--sub)">—</span>':`${v}`;}
const raBtn=no=>`<span data-ra="${no}" style="min-height:44px;min-width:88px;padding:0 14px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--emerald);color:var(--emerald-2);border-radius:999px;font-weight:700;font-size:13.5px;cursor:pointer">退货申诉</span>`;
function returnCard(g){
  return `<div class="dl-rcard" data-rno="${g.no}" style="cursor:pointer">
    <div class="r1"><span class="no">${g.no}</span><span class="lbl">客退退货单</span><span class="st">${g.st}</span></div>
    <div class="r2"><span class="ware">${g.ware}<span class="dot"></span></span></div>
    <div class="dl-kbox" style="margin-top:10px;padding:10px 0"><div class="k"><div class="l">退回数量</div><div class="v">${retSum(g)}</div></div><div class="k"><div class="l">取回数量</div><div class="v">${pickHtml(g)}</div></div><div class="k"><div class="l">退货金额</div><div class="v">${g.items.some(x=>x.price==null)?'—':fmtS(retAmt(g))}</div></div></div>
    <div class="info">${g.arrive?`到仓时间：${g.arrive}`:`${g.order} 下单`}<br><span class="code">提货码：${g.code}</span><br><span class="dl-deadline">${g.st==='待提货'?'已到仓，凭提货码到仓提货':g.st==='待仓库入库'?'待仓库确认到货':g.st==='已提货'?`已于 ${g.pickup} 提货`:'—'}</span></div>
    ${raLine(g)?`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px"><span>${raLine(g)}</span>${raOpen(g)?raBtn(g.no):''}</div>`:''}
  </div>`;
}
// 客户退货详情：单据信息 + 逐商品退回/取回数量（只读）
function openReturnDetail(no){
  const g=RETURN.find(x=>x.no===no); if(!g)return;
  const kv=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--sub);flex-shrink:0">${k}</span><span style="text-align:right;font-weight:500;word-break:break-all">${v||'—'}</span></div>`;
  const sec=t=>`<div style="margin:16px 16px 6px;font-weight:700;font-size:14px">${t}</div>`;
  const box=i=>`<div style="margin:0 16px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:12px;padding:2px 14px">${i}</div>`;
  pushPage({title:'退货单详情',navbar:true,body:`
    <div class="dl-kbox" style="margin:12px 16px 0;background:#fff;box-shadow:var(--sh-sm)"><div class="k"><div class="l">退回数量</div><div class="v">${retSum(g)}</div></div><div class="k"><div class="l">取回数量</div><div class="v">${pickHtml(g)}</div></div><div class="k"><div class="l">退货金额</div><div class="v">${fmtS(retAmt(g))}</div></div></div>
    ${sec('单据信息')}
    ${box(kv('退货单号',`<span style="font-family:monospace">${g.no}</span>`)+kv('正向订单号',`<span style="font-family:monospace">${g.orderNo||'—'}</span>`)+kv('状态',g.st)+kv('存放仓库',g.ware)+kv('到仓时间',g.arrive)+kv('提货时间',g.pickup))}
    ${sec('退货明细')}
    ${box(g.items.map(x=>`<div style="padding:11px 0;border-bottom:1px solid rgba(0,0,0,.05)">
      <b style="font-size:14px">${x.name}</b><div style="font-size:11.5px;color:var(--sub);margin-top:3px">${x.sku} · ${x.spec}</div>
      <div style="display:flex;gap:18px;margin-top:8px;font-size:12.5px;color:#46604F;font-variant-numeric:tabular-nums"><span>退回数量 ${x.retQty}</span><span>取回数量 ${pickHtml(g,x)}</span><span>结算单价 ${x.price==null?'—':fmtS(x.price)}</span><span style="margin-left:auto;font-weight:700">${x.price==null?'—':fmtS(Math.round(x.retQty*x.price*100)/100)}</span></div>
    </div>`).join(''))}
    ${raDetail(g,sec,box,kv)}
    <div style="height:8px"></div>`,
    footer:raOpen(g)?`<button class="btn primary" id="ra-go">退货申诉</button>`:'',
    mount:(p)=>{const b=p.querySelector('#ra-go');if(b)b.onclick=()=>openRetAppeal(g,()=>{popPage();openReturnDetail(no);});}});
}
const raTip=t=>`<div style="margin:0 16px;background:var(--mint-soft);color:var(--emerald-2);font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">${t}</div>`;
function raDetail(g,sec,box,kv){
  if(!g)return '';
  const a=g.appeal;
  if(!a){
    const w=raWin(g);if(!w)return '';
    const once=g._whr?'每条退回记录只能申诉 1 次。':'每张退货单只能申诉 1 次。';
    const msg=w.kind==='noarrive'?`货还没到仓。如一直没到仓或有其他问题，可以申诉「未到仓」，不限时间。${once}`
      :(g.st==='已提货'&&!g._pendingCount)?`如发现没拿够、坏了不能卖或有其他问题，可以申诉，不限时间。${once}`
      :`货在仓里。如发现数量不对、坏了不能卖或有其他问题，可以申诉，不限时间。${once}`;
    return sec('退货申诉')+raTip(msg);
  }
  const goods=a.kind==='goods',PL=g._priceLabel||'正向订单结算单价';
  const comp=a.compStatus==='已生成'?`<span style="font-family:monospace">${a.compNo}</span>`:(a.compStatus==='待生成'?'<span style="color:#B45309">生成中</span>':'—');
  return sec('退货申诉')+box(kv('申诉状态',raTag(a.status))+kv('申诉类型',raKindLabel(a))+kv('申诉时间',a.at)+(a.status==='平台处理中'?kv('预计出结果时间',msTs(a.reviewDue)):kv('审核时间',a.reviewAt))+kv('照片',a.photos?a.photos+' 张':'未上传')+kv('说明',a.desc))
    +sec('申诉明细')+box(a.items.map(x=>`<div style="padding:11px 0;border-bottom:1px solid rgba(0,0,0,.05)"><b style="font-size:14px">${x.name}</b>
      ${goods?kv('系统记录',x.sysPick)+kv('实际数量',x.actual)+kv('坏了不能卖',x.damaged):''}${kv('申诉数量',x.qty)}${kv('核定数量',x.ok==null?'—':x.ok)}${kv(PL,x.price==null?'待平台确认':fmtS(x.price))}${kv('赔付金额',x.ok==null||x.price==null?'—':fmtS(r2(x.ok*x.price)))}</div>`).join(''))
    +(a.status!=='平台处理中'?sec('审核结果')+box(kv('赔付合计',a.comp>0?`<span style="color:var(--emerald-2)">${fmtS(a.comp)}</span>`:fmtS(0))+kv('赔付单',comp)+kv('审核说明',a.note)):'');
}
/* 退货申诉表单：按实际情况填写（实际拿到 / 坏了几件，系统算申诉数量与预计赔付）→ 提交 */
function openRetAppeal(g,onDone){
  if(!raOpen(g))return toast('该单不能申诉');
  const w=raWin(g),goods=w.kind==='goods';let photo=false,dirty=false;
  // 列名与 PC 统一「系统记录 / 实际数量 / 其中坏了不能卖」，按状态只换一句提示
  const sysL=()=>'系统记录',actL=()=>'实际数量';let other=false;
  const actTip=g._whr?'已取回的填实际拿到的，待取回的填仓里实际有的':(g.st==='已提货'?'填你实际拿到的件数':'填已拿到的加上仓里还在的件数');
  const inp=(cls,k,v,mx)=>`<input class="${cls}" data-k="${k}" type="number" inputmode="decimal" min="0" ${mx!=null?`max="${mx}"`:''} step="any" value="${v}" style="width:76px;height:44px;text-align:center;font-size:16px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit">`;
  const line=(l,r)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0"><span style="font-size:13px;color:#46604F">${l}</span>${r}</div>`;
  pushPage({title:'退货申诉',body:`
    <div style="margin:13px 16px 0;background:var(--mint-soft);color:var(--emerald-2);font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">${g._whr?'每条退回记录':'每张退货单'}<b>只能申诉 1 次</b>，平台在 <b>${RA_REVIEW_H} 小时</b>内给出结果。本申诉只针对退回的货，不影响原售后单判责。</div>
    ${g._pendingCount?`<div style="margin:10px 16px 0;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">本条退回记录还有 <b>${g._pendingCount} 项</b>未取回。每条记录只能申诉 1 次，提交后这些商品取回时<b>不能再申诉</b>。</div>`:''}
    <div class="as-dblock" style="margin-top:13px"><div class="bt"><span>申诉原因</span></div>
      <div style="display:flex;gap:8px">${[[0,goods?'数量不对或有损坏':'货没到仓'],[1,'数量没问题，是其他问题']].map(([v,t])=>`<span data-oth="${v}" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid ${v?'var(--line)':'var(--emerald)'};background:${v?'#fff':'var(--mint-soft)'};color:${v?'#27433A':'var(--emerald-2)'}">${t}</span>`).join('')}</div>
      <div id="ra-oth-tip" style="display:none;margin-top:10px;font-size:12.5px;color:var(--sub);line-height:1.6">按「其他」申诉，不用填数量。请在下方说明里写清楚问题，客服核实后定赔付数量。</div></div>
    <div class="as-dblock" id="ra-items"><div class="bt"><span>${goods?'按实际情况填写':'没到仓数量'}</span><span style="font-size:12px;color:var(--sub);font-weight:400">${goods?actTip:'默认全部，只到了一部分的改小'}</span></div>
      ${g.items.map((x,k)=>{const sp=raSys(g,x);return `<div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05)">
        <b style="font-size:14px">${x.name}</b>${g._whr?`<span style="font-size:11.5px;color:var(--sub);margin-left:6px">${x._picked?'已取回':'待取回'}</span>`:''}
        ${line('退回数量',`<span>${x.retQty} ${x.unit}</span>`)}
        ${goods?line(sysL(x),`<span>${sp} ${x.unit}</span>`)+line(actL(x),inp('ra-act',k,sp,x.retQty))+line('其中坏了不能卖',inp('ra-dmg',k,0,null)):line('未到仓数量',inp('ra-na',k,x.retQty,x.retQty))}
        ${line('申诉数量',`<b id="ra-q-${k}">0</b>`)}
        ${line(g._priceLabel||'正向订单结算单价',`<span>${x.price==null?'<span style="color:#B45309">待平台确认</span>':fmtS(x.price)+'/'+x.unit}</span>`)}
      </div>`;}).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:13px"><span style="color:var(--sub)">预计赔付</span><b id="ra-total" style="font-size:17px;color:var(--emerald-2)">—</b></div>
      <div id="ra-nop" style="font-size:12px;color:#B45309;text-align:right"></div></div>
    <div class="as-dblock"><div class="bt"><span>说明</span><span id="ra-descreq" style="font-size:12px;color:var(--sub);font-weight:400">选填，最多 500 字</span></div>
      <textarea id="ra-desc" maxlength="500" placeholder="例：到仓提货时仓库只找到 1 箱番茄" style="width:100%;min-height:80px;border:1.5px solid var(--line);border-radius:12px;padding:11px;font-size:16px;font-family:inherit;outline:none;resize:none"></textarea></div>
    <div class="as-dblock"><div class="bt"><span>照片</span><span id="ra-phreq" style="font-size:12px;font-weight:400;color:var(--sub)">选填</span></div>
      <div class="as-imgs"><div class="im" id="ra-ph" style="width:72px;height:72px;cursor:pointer;display:flex;align-items:center;justify-content:center">${svg('box')}</div></div>
      <div style="font-size:12px;color:var(--sub);margin-top:6px">货物现状 / 提货单 / 包装标签，最多 9 张</div></div>
    <div style="height:6px"></div>`,
    footer:`<button class="btn primary" id="ra-sub">提交申诉</button>`,
    mount:(p)=>{
      const q=sel=>p.querySelector(sel);
      // 有填写时点返回先确认，避免误触丢内容
      const back=p.querySelector('.back');if(back)back.onclick=()=>{if(!dirty)return popPage();confirmDialog({title:'放弃填写？',body:'已填写的内容不会保存。',okText:'放弃',onOk:popPage});};
      const vals=()=>g.items.map((x,k)=>{
        if(other)return {k,ret:x.retQty,sysPick:raSys(g,x),actual:null,damaged:0,short:0,qty:0,price:x.price};
        if(!goods){const el=q(`.ra-na[data-k="${k}"]`);const v=Math.min(Math.max(r2(el.value),0),x.retQty);return {k,ret:x.retQty,qty:v,price:x.price};}
        const act=Math.min(Math.max(r2(q(`.ra-act[data-k="${k}"]`).value),0),x.retQty),dmg=Math.min(Math.max(r2(q(`.ra-dmg[data-k="${k}"]`).value),0),act);
        const short=r2(x.retQty-act);return {k,ret:x.retQty,sysPick:raSys(g,x),actual:act,damaged:dmg,short,qty:r2(short+dmg),price:x.price};});
      const calc=()=>{const vs=vals();vs.forEach(v=>{q('#ra-q-'+v.k).textContent=v.qty;});
        q('#ra-total').textContent=fmtS(vs.reduce((s,v)=>s+(v.price==null?0:r2(v.qty*v.price)),0));
        const nop=vs.filter(v=>v.price==null&&v.qty>0).reduce((s,v)=>s+v.qty,0);q('#ra-nop').textContent=nop?`另有 ${nop} 件单价待平台确认，按审核结果赔付`:'';
        const dm=vs.some(v=>v.damaged>0);const rq=q('#ra-phreq');rq.textContent=dm?'有损坏，必填，至少 1 张':'选填';rq.style.color=dm?'var(--red)':'var(--sub)';
        const dr=q('#ra-descreq');dr.textContent=other?'必填，最多 500 字':'选填，最多 500 字';dr.style.color=other?'var(--red)':'var(--sub)';};
      // 申诉原因二选一：其他 = 不填数量、说明必填（设计评审 P0：不靠商家逐行清零触发）
      p.querySelectorAll('[data-oth]').forEach(el=>el.onclick=()=>{other=el.dataset.oth==='1';dirty=true;
        p.querySelectorAll('[data-oth]').forEach(e=>{const on=e===el;e.style.borderColor=on?'var(--emerald)':'var(--line)';e.style.background=on?'var(--mint-soft)':'#fff';e.style.color=on?'var(--emerald-2)':'#27433A';});
        q('#ra-items').style.display=other?'none':'';q('#ra-oth-tip').style.display=other?'':'none';calc();});
      // 失焦时把超范围的值改回范围内，看到的 = 提交的
      p.querySelectorAll('.ra-act,.ra-dmg,.ra-na').forEach(el=>{el.oninput=()=>{dirty=true;calc();};el.onblur=()=>{
        const k=+el.dataset.k,x=g.items[k];let mx=x.retQty;if(el.classList.contains('ra-dmg'))mx=Math.max(r2(q(`.ra-act[data-k="${k}"]`).value),0);
        let v=r2(el.value);if(v<0)v=0;if(v>mx){v=mx;toast(`最多 ${mx}`);}el.value=v;
        if(el.classList.contains('ra-act')){const d=q(`.ra-dmg[data-k="${k}"]`);if(+d.value>v)d.value=v;}calc();};});
      q('#ra-desc').oninput=()=>{dirty=true;};
      calc();
      q('#ra-ph').onclick=()=>{photo=true;dirty=true;q('#ra-ph').innerHTML='<span style="font-size:12px;color:var(--emerald-2);font-weight:700">已传 2 张</span>';};
      q('#ra-sub').onclick=()=>{
        const b=q('#ra-sub');if(b.classList.contains('loading'))return;
        const vs=vals(),desc=q('#ra-desc').value.trim();
        if(other&&!desc)return toast('请在说明里写清楚是什么问题');
        if(!other&&!vs.some(v=>v.qty>0))return toast('数量都没问题，请选「数量没问题，是其他问题」');
        if(vs.some(v=>v.damaged>0)&&!photo)return toast('有损坏的商品请至少上传 1 张照片');
        b.classList.add('loading');
        setTimeout(()=>{b.classList.remove('loading');
          g.appeal={kind:w.kind,other,status:'平台处理中',at:nowTs(),reviewDue:Date.now()+RA_REVIEW_H*3600000,desc,photos:photo?2:0,compStatus:'无需',
            items:vs.filter(v=>other||v.qty>0).map(v=>({name:g.items[v.k].name,ret:v.ret,sysPick:v.sysPick,actual:v.actual,damaged:v.damaged,short:v.short,qty:v.qty,cap:other?v.ret:v.qty,price:v.price,ok:null}))};
          if(g._save)g._save(g.appeal);
          toast('退货申诉已提交，平台将在 48 小时内给出结果');
          if(g._whr){if(window._whrRedraw)window._whrRedraw();}else if(window._rtRedraw)window._rtRedraw();
          // 从详情进来的：回到刷新后的详情，直接看到「平台处理中」；从列表进来的：回列表
          setTimeout(()=>{popPage();if(onDone)onDone();},600);},600);
      };
    }});
}
/* ============ 仓库退回（错货）—— 2026-08-12 纪要：不新增单据与单号，
   沿用原送货单标记，仓库台账+多角度照片+专属虚拟库位，商家线下取回。
   与 PC pc-modules/delivery.js 的 DB.whReturns 同源同口径。

   ⚠️ 2026-09-15 沈亮拍板（BR-16c）：「送多」不再走退回。商家实送多于应送时仓库
   照收不设上限，多收量在送货单商品明细的差异里正向展示，并入在仓寄存库存
   （当日不可卖、次日优先抵扣，BR-16d）。本台账只保留「送错」一种类型。 ============ */
window.FM.DB.whReturns = window.FM.DB.whReturns || [
  {returnNo:'WR20260628001',deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8899',name:'上海青',spec:'1kg/件',unit:'件',
   type:'送错',qty:6,photos:3,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:22',status:'待取回',pickedQty:null,pickedAt:'',price:3.20,
   note:'与本单小棠菜串货，实物为上海青'},
  {returnNo:'WR20260628001',deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8871',name:'菜心',spec:'1kg/件',unit:'件',
   type:'送错',qty:3,photos:2,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:25',status:'已取回',pickedQty:2,pickedAt:relTs(-4),price:2.80,
   note:'应送清单无此 SKU，实物为菜心'},
  {returnNo:'WR20260629001',deliveryNo:'SH20260629005',warehouse:'兀兰DC',skuCode:'SKU8806',name:'芥兰',spec:'1kg/件',unit:'件',
   type:'送错',qty:4,photos:2,slot:'WD-VIRT-03',registeredAt:'2026-06-29 03:40',status:'待取回',pickedQty:null,pickedAt:'',price:3.50,
   note:'应送清单无此 SKU，实物为芥兰'},
  {returnNo:'WR20260628002',deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8875',name:'生菜',spec:'1kg/件',unit:'件',
   type:'送错',qty:4,photos:2,slot:'SG-VIRT-01',registeredAt:'2026-06-28 09:10',status:'已取回',pickedQty:4,pickedAt:relTs(-6),price:2.50,
   note:'同一送货单第二次推送的退回记录'},
  {returnNo:'SH20260518001',deliveryNo:'SH20260518001',warehouse:'裕廊DC',skuCode:'SKU8812',name:'咸鸭蛋',spec:'30枚/盘',unit:'盘',
   type:'送错',qty:2,photos:3,slot:'JR-VIRT-07',registeredAt:'2026-05-18 02:30',status:'已取回',pickedQty:2,pickedAt:'2026-05-20 10:15',price:9.00,
   note:'与本单鲜鸡蛋串货'},
];
const WHR=()=>window.FM.DB.whReturns||[];
/* 仓库退回申诉（scm_退货申诉_prd.md，与 PC pc-modules/delivery.js whrAdapter 同口径）：
   以【退回单号 returnNo】为单位（一张送货单可多条退回记录），每条 1 次；2026-10-27 起待取回 / 已取回都能申诉、不限时间；
   赔付 = 核定数量 × 商品售价（10-27 会议：仓库丢损按售价赔、不扣佣金）→ 赔付单推送进结算单 */
window.FM.DB.whrAppeals = window.FM.DB.whrAppeals || {
  'SH20260518001':{kind:'goods',status:'成立',at:'2026-05-20 16:40',reviewAt:'2026-05-21 10:05',desc:'取回时 1 盘蛋壳大面积破裂',photos:3,compStatus:'已生成',
    items:[{name:'咸鸭蛋',ret:2,sysPick:2,actual:2,damaged:1,short:0,qty:1,price:9.00,ok:1}],comp:9.00,compNo:'RC-20260521-208',note:'仓库虚拟库位叠放压损，平台承担'}
};
function whrAdapter(no){
  const g=whrGroups().find(x=>x.no===no); if(!g)return null;
  const pc=g.list.filter(x=>x.status==='已取回').length;
  return {_whr:true,_priceLabel:'商品售价',_pendingCount:g.list.length-pc,no,st:pc?'已提货':'待提货',appeal:window.FM.DB.whrAppeals[no]||null,
    items:g.list.map(r=>({name:r.name,sku:r.skuCode,spec:r.spec,unit:r.unit,retQty:r.qty,pickQty:r.pickedQty,price:r.price,_picked:r.status==='已取回'})),
    _save:ra=>{window.FM.DB.whrAppeals[no]=ra;}};
}
function whrOf(id){return WHR().filter(r=>r.deliveryNo===id);}
window.whrOfDelivery=whrOf;
function whrGroups(){
  const map={};WHR().forEach(r=>{const k=r.returnNo||r.deliveryNo;(map[k]=map[k]||[]).push(r);});
  return Object.keys(map).map(no=>{
    const list=map[no].slice().sort((a,b)=>(a.type==='送错'?0:1)-(b.type==='送错'?0:1));
    const wait=list.filter(x=>x.status==='待取回').length;
    return {no,deliveryNo:list[0].deliveryNo,list,warehouse:list[0].warehouse,slot:[...new Set(list.map(x=>x.slot))].join(' / '),
      at:list.map(x=>x.registeredAt).sort()[0],qty:list.reduce((a,x)=>a+x.qty,0),
      // 取回数量 = Σ 已取回项 pickedQty；整单未取 → null（「—」）
      pickedQty:wait===list.length?null:list.filter(x=>x.status==='已取回').reduce((a,x)=>a+(x.pickedQty||0),0),wait,
      status:wait===0?'已取回':(wait===list.length?'待取回':'部分取回')};
  }).sort((a,b)=>b.at.localeCompare(a.at));
}
function whrSum(list){
  return [...new Set(list.map(x=>x.type))]
    .map(t=>`${t} ${list.filter(x=>x.type===t).reduce((a,x)=>a+x.qty,0)}${list.find(x=>x.type===t).unit}`).join(' · ');
}
function whrTypeChip(t){return stChip(t,t==='送错'?'var(--red-soft)':'var(--amber-soft)',t==='送错'?'var(--red)':'#B45309');}
function whrStChip(g){
  if(g.status==='已取回')return stChip('已取回','var(--mint-soft)','var(--emerald-2)');
  if(g.status==='部分取回')return stChip(`部分取回 ${g.list.length-g.wait}/${g.list.length}`,'var(--amber-soft)','#B45309');
  return stChip(`待取回 ${g.list.length} 项`,'#E1EBFF','#2563EB');
}
// 列表：一张卡片=一条退回记录（退回单号）；一张送货单可能有多条
function whrCard(g){
  return `<div class="dl-card" data-whr="${g.no}" data-dno="${g.deliveryNo}">
    <div class="dl-ch"><span>退回单号</span><span class="no">${g.no}</span></div>
    <div class="dl-meta"><span class="k">来源送货单</span><span class="vv">${g.deliveryNo}</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin:9px 0 3px;flex-wrap:wrap">
      ${[...new Set(g.list.map(x=>x.type))].map(whrTypeChip).join('')}${whrStChip(g)}
    </div>
    <div class="dl-meta"><span class="k">退回商品</span><span class="vv">${g.list.map(x=>x.name).join('、')} · 共 ${g.list.length} 个 SKU</span></div>
    <div class="dl-meta"><span class="k">类型合计</span><span class="vv">${whrSum(g.list)}</span></div>
    <div class="dl-meta"><span class="k">存放</span><span class="vv">${g.warehouse} · ${g.slot}</span></div>
    <div class="dl-meta"><span class="k">登记</span><span class="vv">${g.at}</span></div>
    <div class="dl-kbox"><div class="k"><div class="l">退回数量</div><div class="v">${g.qty}</div></div><div class="k"><div class="l">取回数量</div><div class="v">${g.pickedQty==null?'<span style="color:var(--sub)">—</span>':g.pickedQty}</div></div></div>
    ${(()=>{const ad=whrAdapter(g.no),l=ad?raLine(ad):'';return l?`<div style="margin-top:10px;font-size:12.5px">${l}</div>`:'';})()}
    <div class="dl-acts"><div class="a key" data-a="whrdetail">详情</div>${(()=>{const ad=whrAdapter(g.no);return ad&&raOpen(ad)?'<div class="a" data-a="whrappeal">退货申诉</div>':'';})()}<div class="a" data-a="whrdeliv">送货单</div></div>
  </div>`;
}
// 详情：逐 SKU 区分
function openWhrDetail(no){
  const g=whrGroups().find(x=>x.no===no); if(!g)return;
  const kv=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--sub);flex-shrink:0">${k}</span><span style="text-align:right;font-weight:500;word-break:break-all">${v||'—'}</span></div>`;
  const sec=t=>`<div style="margin:16px 16px 6px;font-weight:700;font-size:14px">${t}</div>`;
  const box=i=>`<div style="margin:0 16px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:12px;padding:2px 14px">${i}</div>`;
  pushPage({title:'仓库退回详情',navbar:true,body:`
    <div style="margin:12px 16px 0;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
      本单被清点出 <b>${whrSum(g.list)}</b>，仓库已登记台账、留存实物照片并放入专属虚拟库位暂存。这批货<b>不计入结算、不产生扣款也不付款</b>，请线下与仓库约时间取回。
    </div>
    ${sec('单据信息')}
    ${box(
      kv('退回单号',`<span style="font-family:monospace">${g.no}</span>`)+
      kv('来源送货单',`<span style="font-family:monospace">${g.deliveryNo}</span>`)+
      kv('存放仓库',g.warehouse)+
      kv('虚拟库位',`<span style="font-family:monospace">${g.slot}</span>`)+
      kv('首次登记时间',g.at)+
      kv('退回商品',`${g.list.length} 个 SKU`)+
      kv('退回数量',`${g.qty}`)+
      kv('取回数量',g.pickedQty==null?'—':`${g.pickedQty}`)
    )}
    ${sec('退回商品明细 · 逐 SKU')}
    ${box(g.list.map(r=>`<div style="padding:11px 0;border-bottom:1px solid rgba(0,0,0,.05)">
      <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${r.name}</b>${whrTypeChip(r.type)}${r.status==='已取回'?stChip('已取回','var(--mint-soft)','var(--emerald-2)'):stChip('待取回','#E1EBFF','#2563EB')}</div>
      <div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.skuCode} · ${r.spec}</div>
      ${r.note?`<div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.note}</div>`:''}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12.5px;color:#46604F;flex-wrap:wrap">
        <span>退回 <b>${r.qty}</b> ${r.unit}</span><span>取回 ${r.status==='已取回'?`<b>${r.pickedQty}</b> ${r.unit}`:'<b style="color:var(--sub)">—</b>'}</span><span>库位 <span style="font-family:monospace">${r.slot}</span></span><span>登记 ${r.registeredAt}</span>${r.pickedAt?`<span>取回时间 ${r.pickedAt}</span>`:''}
      </div>
      <div class="whr-ph" data-sku="${r.skuCode}" style="margin-top:8px;color:var(--emerald);font-weight:700;font-size:12.5px;min-height:32px;display:flex;align-items:center;cursor:pointer">📷 ${r.photos} 张实物照片</div>
    </div>`).join(''))}
    <div style="margin:12px 16px 0;font-size:11.5px;color:var(--sub);line-height:1.6">状态由<b>仓库</b>在交接时<b>按项</b>回写，同单可分批取回；商家端只读，无编辑与线上预约入口。</div>
    ${raDetail(whrAdapter(g.no),sec,box,kv)}
    <div style="height:8px"></div>`,
    footer:(()=>{const ad=whrAdapter(g.no);return ad&&raOpen(ad)?`<div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1" id="whr-go">查看送货单</button><button class="btn primary" style="flex:1" id="whr-ra">退货申诉</button></div>`:`<button class="btn primary" style="width:100%" id="whr-go">查看送货单</button>`;})(),
    mount:(p)=>{
      const ra=p.querySelector('#whr-ra');if(ra)ra.onclick=()=>openRetAppeal(whrAdapter(g.no),()=>{popPage();openWhrDetail(no);});
      p.querySelectorAll('.whr-ph').forEach(e=>e.onclick=()=>openWhrPhotos(g.deliveryNo,e.dataset.sku));
      const b=p.querySelector('#whr-go');if(b)b.onclick=()=>{popPage();window.FM.DB.delivView=g.deliveryNo;openSignin();};
    }});
}
function openWhrPhotos(no,sku){
  const r=WHR().find(x=>x.deliveryNo===no&&x.skuCode===sku); if(!r)return;
  pushPage({title:'仓库留存照片',navbar:true,body:`
    <div style="margin:12px 16px;background:#E1EBFF;color:#2563EB;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
      照片由仓库在登记台账时<b>多角度拍摄留存</b>，作为错货的实物凭证；商家端只读。
    </div>
    <div style="margin:0 16px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${Array.from({length:r.photos}).map((_,i)=>`<div style="aspect-ratio:4/3;background:var(--muted);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:12.5px">实物照片 ${i+1}</div>`).join('')}
    </div>
    <div style="margin:12px 16px;font-size:12.5px;color:var(--sub)">${r.name} · ${r.type} ${r.qty}${r.unit} · 存放 ${r.warehouse} · <span style="font-family:monospace">${r.slot}</span>（专属虚拟库位，不计入正常库存）</div>`});
}

function openReturn(){
  pushPage({title:'退货单',body:`
    <div class="iv-seg" id="rt-seg" style="display:flex;gap:6px;background:var(--muted);border-radius:14px;margin:10px 16px 4px;padding:4px">
      <span class="s on" data-s="cust" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--emerald-2);border-radius:11px;background:#fff;box-shadow:var(--sh-sm);cursor:pointer">客户退货</span>
      <span class="s" data-s="whr" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--sub);border-radius:11px;cursor:pointer">仓库退回</span>
    </div>
    <div id="rt-cust">
    <div class="dl-filters"><span class="dl-drop" data-f="ware">全部仓库 <span class="ca">▾</span></span><span class="dl-drop" data-f="bill">全部单据 <span class="ca">▾</span></span></div>
    <div class="dl-tabs" id="dl-rtab"><span class="t on" data-t="all">全部</span><span class="t" data-t="待仓库入库">待仓库入库</span><span class="t" data-t="待提货">待提货</span><span class="t" data-t="已提货">已提货</span></div>
    <div class="dl-list" id="dl-rtl"></div></div>
    <div id="rt-whr" style="display:none"></div>`,
    mount:(p)=>{
      const list=p.querySelector('#dl-rtl');
      // 来源分段：客户退货（客户售后退回）/ 仓库退回（送货单里送错；送多自 2026-09-15 起照收不退）
      const segs=p.querySelectorAll('#rt-seg .s'), cust=p.querySelector('#rt-cust'), whr=p.querySelector('#rt-whr');
      function drawWhr(){
        const gs=whrGroups();
        whr.innerHTML=gs.length?`
          <div style="margin:8px 16px 10px;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
            <b>仓库退回</b>＝你送到仓的商品中被清点出<b>送错</b>（应送清单外的 SKU）的部分。这批货<b>不计入结算、不产生扣款也不付款</b>，仓库已放入专属虚拟库位暂存，请<b>线下联系仓库约时间取回</b>。每条退回记录有自己的<b>退回单号</b>，一张送货单可能有多条。<br><b>多送同一 SKU 不进这里</b>：仓库照收，计入你的在仓寄存库存，当日不参与售卖、次日优先抵扣应送量。
          </div>
          <div class="dl-list">${gs.map(whrCard).join('')}</div>`
          :`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无待退回商品</h4><p>送货到仓被清点出送错（应送清单外的 SKU）时，仓库登记台账后在此生成取货通知；多送同一 SKU 仓库照收，不在这里</p></div>`;
        whr.querySelectorAll('[data-whr]').forEach(c=>{
          const no=c.dataset.whr;
          c.querySelectorAll('[data-a]').forEach(b=>b.onclick=e=>{e.stopPropagation();
            if(b.dataset.a==='whrdetail')openWhrDetail(no); else if(b.dataset.a==='whrappeal')openRetAppeal(whrAdapter(no)); else {window.FM.DB.delivView=c.dataset.dno;openSignin();}});
        });
      }
      window._whrRedraw=drawWhr;
      segs.forEach(sg=>sg.onclick=()=>{
        segs.forEach(x=>{const on=x===sg;x.style.background=on?'#fff':'transparent';x.style.color=on?'var(--emerald-2)':'var(--sub)';x.style.boxShadow=on?'var(--sh-sm)':'none';});
        const isWhr=sg.dataset.s==='whr';
        cust.style.display=isWhr?'none':'block'; whr.style.display=isWhr?'block':'none';
        if(isWhr)drawWhr();
      });
      const draw=(t)=>{
        list.innerHTML=skel(2);
        setTimeout(()=>{
          const data=t==='all'?RETURN:RETURN.filter(g=>g.st===t);
          if(!data.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('refund')}</div><h4>暂无${t==='all'?'':t}退货单</h4><p>退货退款售后单判责后会在此展示到仓提货进度</p></div>`;return;}
          list.innerHTML=data.map(returnCard).join('');
          list.querySelectorAll('[data-rno]').forEach(e=>e.onclick=()=>openReturnDetail(e.dataset.rno));
          list.querySelectorAll('[data-ra]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();openRetAppeal(RETURN.find(x=>x.no===e.dataset.ra));});
        },420);
      };
      let cur='all';
      window._rtRedraw=()=>draw(cur);
      draw('all');
      p.querySelectorAll('#dl-rtab .t').forEach(t=>t.onclick=()=>{p.querySelectorAll('#dl-rtab .t').forEach(x=>x.classList.remove('on'));t.classList.add('on');cur=t.dataset.t;draw(cur);});
      p.querySelectorAll('.dl-drop').forEach(d=>d.onclick=()=>sheet([{label:d.dataset.f==='ware'?'裕廊DC':'客退退货单',onClick:()=>toast('已筛选')},{label:d.dataset.f==='ware'?'兀兰DC':'报损退货单',onClick:()=>toast('已筛选')}]));
    }});
}
// 预约提货 / 新建退货单 已按 2026-07-21 会议移除：提货确认统一由仓库操作、商家端只读；三方退款须基于已判责售后工单，商家不可自建退货单。

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.signin=openSignin;
window.FM_MOD.progress=openProgress;
window.FM_MOD.return=openReturn;
// 退货赔付（财务 › 退货赔付，retcomp.js）取数：核定成立/部分成立且赔付>0 的申诉，一笔一行
window.FM_MOD.retCompSrc=()=>{
  const out=[];
  RETURN.forEach(g=>{const ra=g.appeal;if(ra&&ra.comp>0)out.push({compNo:ra.compNo,src:'客户退货',retNo:g.no,ra,priceLabel:'正向订单结算单价',open:()=>openReturnDetail(g.no)});});
  const wa=window.FM.DB.whrAppeals||{};
  Object.keys(wa).forEach(no=>{const ra=wa[no];if(ra&&ra.comp>0)out.push({compNo:ra.compNo,src:'仓库退回',retNo:no,ra,priceLabel:'商品售价',open:()=>openWhrDetail(no)});});
  return out;
};
window.FM_MOD.raKindLabel=raKindLabel;
// 金刚区「退货单」磁贴角标 = 客户退货待提货单数 + 仓库退回待取回项数（与 PC 侧栏角标同源同口径）
window.FM_MOD.returnBadge=()=>RETURN.filter(g=>g.st==='待提货').length+(window.FM.DB.whReturns||[]).filter(r=>r.status==='待取回').length;
})();
