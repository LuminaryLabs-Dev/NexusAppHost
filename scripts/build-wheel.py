"""Build the example wheel deterministically without downloads or build tools."""
import base64, csv, hashlib, io, pathlib, zipfile
root = pathlib.Path(__file__).resolve().parent.parent
example = root / 'examples' / 'python'
dist = 'signal_check-1.0.0.dist-info'
files = {
    'signal_check.py': (example / 'signal_check.py').read_bytes(),
    f'{dist}/METADATA': b'Metadata-Version: 2.1\nName: signal-check\nVersion: 1.0.0\nSummary: Nexus offline Python example\n\n',
    f'{dist}/WHEEL': b'Wheel-Version: 1.0\nGenerator: nexus-example-builder\nRoot-Is-Purelib: true\nTag: py3-none-any\n',
}
record = io.StringIO(newline='')
writer = csv.writer(record, lineterminator='\n')
for name, data in sorted(files.items()):
    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode()
    writer.writerow([name, 'sha256=' + digest, len(data)])
writer.writerow([f'{dist}/RECORD', '', ''])
files[f'{dist}/RECORD'] = record.getvalue().encode()
wheel = example / 'signal_check-1.0.0-py3-none-any.whl'
with zipfile.ZipFile(wheel, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
(example / 'style.css').write_bytes((root / 'examples' / 'esm' / 'style.css').read_bytes())
print('Built', wheel.name)
