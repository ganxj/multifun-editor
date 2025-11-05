# 使用nginx作为生产服务器
FROM nginx:alpine

# 删除默认配置文件
RUN rm /etc/nginx/conf.d/default.conf

# 复制自定义nginx配置到正确的目录
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建的文件到nginx目录
COPY ./build /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]