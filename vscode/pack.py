#!/usr/bin/env python3
"""この拡張を VSIX (VSCode の拡張のパッケージ, 中身は zip) に固めて入れる.

  python3 vscode/pack.py            # vscode/publish-or-perish.vsix を作る
  python3 vscode/pack.py --install  # 作って code --install-extension で入れる

公式の vsce (npm) を使わずに済むよう, VSIX に要る 2 つの目録 ([Content_Types].xml と
extension.vsixmanifest) をここで書く. 入れたあとは VSCode で「ウィンドウの再読み込み」をする.
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
FILES = ['package.json', 'extension.js']

CONTENT_TYPES = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension=".json" ContentType="application/json"/>
<Default Extension=".js" ContentType="application/javascript"/>
<Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
'''


def manifest(pkg):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}"/>
    <DisplayName>{escape(pkg['displayName'])}</DisplayName>
    <Description xml:space="preserve">{escape(pkg['description'])}</Description>
    <Categories>{','.join(pkg.get('categories', []))}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{pkg['engines']['vscode']}"/>
    </Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
'''


def main():
    pkg = json.loads((HERE / 'package.json').read_text())
    out = HERE / f"{pkg['name']}.vsix"
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('extension.vsixmanifest', manifest(pkg))
        for f in FILES:
            z.write(HERE / f, f'extension/{f}')
    print(out)
    if '--install' in sys.argv:
        subprocess.run(['code', '--install-extension', str(out), '--force'], check=True)


if __name__ == '__main__':
    main()
