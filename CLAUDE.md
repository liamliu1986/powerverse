# 测试环境服务器

- IP: 172.18.68.183
- SSH 用户名: liuzhi
- SSH 私钥: C:\Users\liuzh\.ssh\id_rsa

## 部署命令

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa liuzhi@172.18.68.183
cd /root/powerverse
git pull origin master
docker compose down
docker compose up -d
```

## 服务地址

- Web UI: http://172.18.68.183:8080
- API: http://172.18.68.183:8001
- Grafana: http://172.18.68.183:3000
- Prometheus: http://172.18.68.183:9090
