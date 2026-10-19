"""Finalize the 22-second render as a seamless, silent 20-second H.264 loop."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess

ROOT=Path(__file__).resolve().parent

def executable(name):
    selected=os.environ.get(name.upper()+'_BINARY')or os.environ.get(name.upper())or shutil.which(name)
    if not selected:
        raise RuntimeError(f'{name} is required. Put it on PATH or set {name.upper()}_BINARY.')
    return selected

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',default='config.json',help='Config path, relative to this script directory unless absolute.')
    parser.add_argument('--output',default='rendered/lake-ontario.mp4',help='Final MP4 path, relative to this script directory unless absolute.')
    args=parser.parse_args()
    config_path=(ROOT/args.config).resolve();cfg=json.loads(config_path.read_text(encoding='utf-8'))
    master=(config_path.parent/cfg['video']).resolve();video=(ROOT/args.output).resolve()
    if not master.is_file():raise FileNotFoundError(f'Render the master first: {master}')
    scratch=video.parent;scratch.mkdir(parents=True,exist_ok=True)
    fps=int(cfg['fps']);assert fps==30,'This film finalizer expects the frozen 30 fps configuration.'
    assert float(cfg['duration'])==22,'This film finalizer expects a 22-second master.'
    ffmpeg=executable('ffmpeg');ffprobe=executable('ffprobe')
    def encode(args):subprocess.run([ffmpeg,'-y','-hide_banner','-loglevel','warning',*args],check=True)
    # Short separate inputs keep the join bounded rather than buffering 20s RGBA.
    graph=('[0:v]trim=duration=2,setpts=PTS-STARTPTS,fps=30,settb=AVTB[t];'
           '[1:v]trim=duration=2,setpts=PTS-STARTPTS,fps=30,settb=AVTB[h];'
           '[t][h]xfade=transition=fade:duration=2:offset=0,format=yuv420p[out]')
    codec=['-an','-c:v','libx264','-crf','21','-preset','medium','-pix_fmt','yuv420p','-threads','2','-r','30','-movflags','+faststart']
    join=scratch/'loop-join.mp4';body=scratch/'loop-body.mp4'
    encode(['-ss','20','-t','2','-i',str(master),'-t','2','-i',str(master),'-filter_complex_threads','1',
            '-filter_complex',graph,'-map','[out]',*codec,'-t','2',str(join)])
    encode(['-ss','2','-i',str(master),'-t','18',*codec,str(body)])
    concat=scratch/'loop-concat.txt'
    concat.write_text("file 'loop-join.mp4'\nfile 'loop-body.mp4'\n",encoding='utf-8',newline='\n')
    encode(['-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(video)])
    probe=json.loads(subprocess.check_output([ffprobe,'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)],text=True))
    assert len(probe['streams'])==1,'Expected one silent video stream.'
    v=probe['streams'][0]
    assert(v['codec_type'],v['codec_name'],v['width'],v['height'],v['pix_fmt'])==('video','h264',cfg['width'],cfg['height'],'yuv420p')
    assert v['avg_frame_rate']=='30/1'and int(v['nb_read_frames'])==600
    assert abs(float(probe['format']['duration'])-20)<.01
    digest=hashlib.sha256(video.read_bytes()).hexdigest()
    # The public verification artifact uses package-relative names, not user paths.
    probe['format']['filename']=video.name;probe['sha256']=digest
    (scratch/'media-verification.json').write_text(json.dumps(probe,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'video':str(video),'bytes':video.stat().st_size,'frames':600,'fps':30,'seconds':20,'audio':False,'sha256':digest}))

if __name__=='__main__':main()
