# 素材说明

## 声音

- 新海浪：**waveslapping_0_1019.WAV**，作者 **cwinasia**。[原作品页面](https://freesound.org/people/cwinasia/sounds/482018/)。许可：**CC0**。录音内容为塞舌尔沙滩上的轻柔小浪；本项目选取片段、平滑循环边界并控制突发水花的峰值。
- 生日音乐：本项目用程序制作的《生日快乐》音乐盒旋律编配，无人声；轻微泛音与短混响，预混音量低于海浪。
- `firework-burst.mp3`：**Single Firework**，作者 **richwise**。[原作品页面](https://freesound.org/people/richwise/sounds/455453/)。许可：**CC0**。打包时提取单发爆响与尾音，并制作五发错开的叠加版本，避免播放录音前后的无关环境声。

海浪与烟花素材均来自作品页面提供的高质量音频资源。[CC0 许可说明](https://creativecommons.org/publicdomain/zero/1.0/)。网页不从素材网站实时加载声音。v4 将海浪与生日旋律预混为 22.05kHz 单声道 PCM WAV，嵌入 `audio-data.js`；烟花也保持内嵌，运行时不读取音频文件。

## 角色

`chiikawa-v2.webp` 和 `hachiware-v2.webp` 是依据用户提供的第三张参考图，使用内置 imagegen 工具制作的透明角色素材；运行时沿椭圆路径移动并轻轻跳舞。角色造型参考吉伊卡哇与小八。

生成提示词见同目录的 [CHARACTER_PROMPTS.txt](CHARACTER_PROMPTS.txt)。WebP 为透明 PNG 生成结果的压缩编码版本。


