import os, subprocess, json, base64, hashlib, datetime
home=os.path.expanduser('~/.hermes/profiles/meshpeer')
kd=os.path.join(home,'mesh-keys')
os.makedirs(kd,mode=0o700,exist_ok=True)
os.chmod(kd,0o700)
priv=os.path.join(kd,'response-private.pem')
pub=os.path.join(kd,'response-public.pem')
if not os.path.exists(priv):
    subprocess.run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:3072','-out',priv],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
os.chmod(priv,0o600)
subprocess.run(['openssl','pkey','-in',priv,'-pubout','-out',pub],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
os.chmod(pub,0o644)
hand='''-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAr2y/O+7H55FcJASGql26
SgTHrSP7UjuArqO8adVjPBWEVP/8h9PT+WR13zoWFlz77K1hgaL+kG1QVMKR6bEk
s5COJgiDlky4J9ai+f1zDpijJZUEU8xS+5uCFHforWSlI7cgdNRH2jJtOgcTCrX7
enNhtiG486wYIUJvaBf/D51/HXlwCPMSFD7JuAZjOHG2tdmomD7by/jvhoZKp1a7
HG4ElZ2s0wM3xoThRqfSkpRdPJAeNmffodgxZc447TT9otwY3BuBSOyxNFvMQdtB
UoIyLZXutMd+iSKu/pnDRIeZtmVydT3V6gNmjV6rnaXpGYLmIdIYdpCOQeIibaV1
Ev2fLTgJw4EzqzRufSIWF5iuIXRMHp7x5knTeGL7fsdFioGxXA99+HtxCFmugmz5
9axeWdDb5uXU4lNUKV/LorJj0xBQPtfCUl6Rn3GAMc6wfBT9+vOamnS535Uv3EQX
jnb9rdm/zeV6R/Z4dkeoVN2RnNAovxPWqAZcvWy41cdbAgMBAAE=
-----END PUBLIC KEY-----
'''
handp=os.path.join(kd,'handymate-public.pem')
with open(handp,'w') as f: f.write(hand)
os.chmod(handp,0o644)
der=subprocess.check_output(['openssl','pkey','-pubin','-in',handp,'-outform','DER'])
assert hashlib.sha256(der).hexdigest()=='cf5cc9f81ab4d490a171e9917f59a8b544189e05d21f12d5a6205102fcca8ec1'
key=next(line.strip().split('=',1)[1] for line in open(os.path.join(home,'.env')) if line.startswith('API_SERVER_KEY='))
ip=subprocess.check_output(['tailscale','ip','-4'],text=True).strip().splitlines()[0]
version=subprocess.check_output(['hermes','--version'],text=True).splitlines()[0]
payload=json.dumps({'agent':'Codehornets','profile':'meshpeer','endpoint':f'http://{ip}:8642/v1','api_key':key,'version':version,'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()},separators=(',',':')).encode()
cipher=subprocess.check_output(['openssl','pkeyutl','-encrypt','-pubin','-inkey',handp,'-pkeyopt','rsa_padding_mode:oaep','-pkeyopt','rsa_oaep_md:sha256','-pkeyopt','rsa_mgf1_md:sha256'],input=payload)
pubtxt=open(pub).read().strip()
pubder=subprocess.check_output(['openssl','pkey','-pubin','-in',pub,'-outform','DER'])
fp=hashlib.sha256(pubder).hexdigest()
report='PUBLIC_KEY_PEM\n```pem\n'+pubtxt+'\n```\n\nPUBLIC_KEY_FINGERPRINT\nSHA-256 '+fp+'\n\nHANDYMATE_ENCRYPTED_CONNECTION_B64\n'+base64.b64encode(cipher).decode()+'\n'
out='/home/codehornets/workspace/hermes-agent/meshpeer-public-report.txt'
with open(out,'w') as f: f.write(report)
print(out)
print('private_key_mode',oct(os.stat(priv).st_mode & 0o777))
print('key_dir_mode',oct(os.stat(kd).st_mode & 0o777))
print('handymate_fingerprint_verified',True)
print('encrypted_payload_bytes',len(payload))