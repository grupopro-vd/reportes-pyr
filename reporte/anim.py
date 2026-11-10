import re, sys, zipfile, shutil
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
def timing(steps):
    nid = [3]
    def n():
        nid[0] += 1; return nid[0]
    out = []
    for st in sorted(steps):
        ids = steps[st]
        a, b = n(), n()
        eff = []
        for k, sp in enumerate(ids):
            c, d, e = n(), n(), n()
            eff.append(f'<p:par><p:cTn id="{c}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="{"clickEffect" if k == 0 else "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                       f'<p:set><p:cBhvr><p:cTn id="{d}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{sp}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
                       f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{e}" dur="450"/><p:tgtEl><p:spTgt spid="{sp}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>')
        out.append(f'<p:par><p:cTn id="{a}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="{b}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{"".join(eff)}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    return ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
            + ''.join(out) + '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>')
for it in zin.infolist():
    data = zin.read(it.filename)
    if re.match(r'ppt/slides/slide\d+\.xml$', it.filename):
        x = data.decode('utf-8')
        steps = {}
        for m in re.finditer(r'<p:cNvPr id="(\d+)" name="A(\d+)_\d+"', x):
            steps.setdefault(int(m.group(2)), []).append(m.group(1))
        if steps and '<p:timing>' not in x:
            t = timing(steps)
            if '</p:clrMapOvr>' in x: x = x.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + t, 1)
            else: x = x.replace('</p:sld>', t + '</p:sld>', 1)
            print(it.filename, {k: len(v) for k, v in steps.items()})
        data = x.encode('utf-8')
    zout.writestr(it, data)
zout.close()
