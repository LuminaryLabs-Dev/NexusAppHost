"""Small offline rule example. Its score is not lead qualification or AI output."""
api = None

def activate(host):
    global api
    api = host

async def request(method, payload):
    if method == 'history':
        return await api.get('last-result')
    if method != 'check':
        raise ValueError('Unknown Signal Check action')
    text = payload.get('text', '')
    if not isinstance(text, str) or len(text) > 10000:
        raise ValueError('Enter at most 10,000 characters')
    signals = [word for word in ['training', 'construction', 'safety', 'simulation'] if word in text.lower()]
    result = {'matchedSignals': signals, 'missingInformation': ['Verify the company and a relevant decision-maker.'], 'status': 'needs-human-review'}
    await api.set('last-result', result)
    api.progress('Signal check saved. Human review is still required.')
    return result
