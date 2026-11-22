"""Windows user-scoped protection for credentials in the local provider catalogues."""
import base64
import binascii
import ctypes
from ctypes import wintypes
from functools import lru_cache
import os


class _Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.c_void_p)]


@lru_cache(maxsize=2)
def _dpapi(protect):
    library = ctypes.WinDLL('crypt32', use_last_error=True)
    operation = library.CryptProtectData if protect else library.CryptUnprotectData
    operation.argtypes = (ctypes.POINTER(_Blob), ctypes.c_void_p, ctypes.POINTER(_Blob),
                          ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob))
    operation.restype = wintypes.BOOL
    free = ctypes.WinDLL('kernel32', use_last_error=True).LocalFree
    free.argtypes = (ctypes.c_void_p,)
    free.restype = ctypes.c_void_p
    return operation, free


def _transform(raw, protect):
    operation, free = _dpapi(protect)
    buffer = ctypes.create_string_buffer(raw)
    source = _Blob(len(raw), ctypes.cast(buffer, ctypes.c_void_p))
    result = _Blob()
    if not operation(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        ctypes.memset(result.data, 0, result.size)
        free(result.data)


def protect_rows(rows):
    if os.name != 'nt' or not isinstance(rows, list):
        return rows
    protected = []
    for row in rows:
        if isinstance(row, dict) and row.get('apiKey'):
            row = row.copy()
            secret = row.pop('apiKey')
            row['protectedApiKey'] = base64.b64encode(_transform(secret.encode('utf-8'), True)).decode('ascii')
        protected.append(row)
    return protected


@lru_cache(maxsize=128)
def _unlock(ciphertext):
    return _transform(base64.b64decode(ciphertext, validate=True), False).decode('utf-8')


def unlock_rows(rows):
    if not isinstance(rows, list):
        return rows
    result = []
    for row in rows:
        if isinstance(row, dict) and row.get('protectedApiKey'):
            row = row.copy()
            row['apiKey'] = ''
            if os.name == 'nt':
                try:
                    row['apiKey'] = _unlock(row['protectedApiKey'])
                    del row['protectedApiKey']
                except (OSError, ValueError, TypeError, binascii.Error):
                    # Keep unreadable ciphertext on unrelated saves. The user can replace
                    # this single key after restoring data under a different Windows login.
                    pass
        result.append(row)
    return result
