import socket,tempfile,unittest,io,json
from contextlib import redirect_stdout
from unittest.mock import patch,Mock
import launch_local
from pathlib import Path
from launch_local import available_port
from local_app import installation_id


class LocalLauncherTests(unittest.TestCase):
    def test_a_busy_port_selects_another_loopback_port(self):
        with socket.socket() as busy:
            busy.bind(('127.0.0.1',0));busy.listen()
            port=available_port(busy.getsockname()[1])
            self.assertNotEqual(port,busy.getsockname()[1])
            with socket.socket() as free:free.bind(('127.0.0.1',port))

    def test_source_release_and_other_data_directories_have_distinct_identities(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            self.assertEqual(installation_id(root,root/'data'),installation_id(root/'.',root/'data'))
            self.assertNotEqual(installation_id(root,root/'data'),installation_id(root/'release',root/'data'))
            self.assertNotEqual(installation_id(root,root/'data'),installation_id(root,root/'other-data'))

    def test_another_installation_or_non_canvasflow_response_cannot_be_reused(self):
        for foreign in ({'mode':'local','installationId':'other-copy'},[]):
            with tempfile.TemporaryDirectory() as folder:
                expected=installation_id(launch_local.ROOT,folder)
                client=Mock();client.open.side_effect=[io.BytesIO(json.dumps(foreign).encode()),
                    io.BytesIO(json.dumps({'mode':'local','installationId':expected}).encode())]
                with patch('sys.argv',['launch_local.py','--port','5173','--no-open']),patch.dict('os.environ',{'CANVASFLOW_DATA_DIR':folder}),\
                     patch.object(launch_local,'build_opener',return_value=client),patch.object(launch_local,'available_port',return_value=5187),\
                     patch.object(launch_local.subprocess,'Popen') as spawn,redirect_stdout(io.StringIO()) as output:
                    launch_local.main()
                self.assertEqual(spawn.call_args.args[0][-1],'5187')
                self.assertIn('http://127.0.0.1:5187/',output.getvalue())

    def test_same_installation_and_data_reuse_the_running_service(self):
        with tempfile.TemporaryDirectory() as folder:
            client=Mock();client.open.return_value=io.BytesIO(json.dumps({'mode':'local',
                'installationId':installation_id(launch_local.ROOT,folder)}).encode())
            with patch('sys.argv',['launch_local.py','--no-open']),patch.dict('os.environ',{'CANVASFLOW_DATA_DIR':folder}),\
                 patch.object(launch_local,'build_opener',return_value=client),\
                 patch.object(launch_local.subprocess,'Popen') as spawn,redirect_stdout(io.StringIO()):
                launch_local.main()
            spawn.assert_not_called()


if __name__=='__main__':unittest.main()
