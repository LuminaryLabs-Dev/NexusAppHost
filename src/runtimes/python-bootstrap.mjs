export const PYTHON_BOOTSTRAP = `
import sys, importlib, inspect, json
sys.path.insert(0, '/app')
class NexusAPI:
    async def get(self, key):
        from pyodide.ffi import to_js
        from js import Object
        value = await _nexus_capability('storage.get', to_js({'key': key}, dict_converter=Object.fromEntries))
        return value.to_py() if hasattr(value, 'to_py') else value
    async def set(self, key, value):
        from pyodide.ffi import to_js
        from js import Object
        return await _nexus_capability('storage.set', to_js({'key': key, 'value': value}, dict_converter=Object.fromEntries))
    def progress(self, text):
        _nexus_progress(str(text))
_module_name, _function_name = _nexus_entry.split(':')
_module = importlib.import_module(_module_name)
_request = getattr(_module, _function_name)
_api = NexusAPI()
if hasattr(_module, 'activate'):
    _result = _module.activate(_api)
    if inspect.isawaitable(_result):
        await _result
async def _nexus_request(method, payload):
    result = _request(method, json.loads(payload))
    if inspect.isawaitable(result):
        result = await result
    return json.dumps(result)
`;
