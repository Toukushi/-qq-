const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 允许跨域（以后分离前端会用到）
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 静态页面
app.use(express.static(path.join(__dirname, 'public')));

// 提取歌单ID（兼容所有格式）
function extractPlaylistId(url) {
    if (!url) return null;

    // 标准格式
    let match = url.match(/playlist\/(\d+)/);
    if (match) return match[1];

    // 微信分享 id=
    match = url.match(/[?&]id=(\d+)/);
    if (match) return match[1];

    // disstid=
    match = url.match(/[?&]disstid=(\d+)/);
    if (match) return match[1];

    return null;
}

// 核心接口
app.get('/api/playlist', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: '请输入歌单链接' });
    }

    const listId = extractPlaylistId(url);

    if (!listId) {
        return res.status(400).json({ error: '无法识别歌单ID' });
    }

    try {
        const apiUrl = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&disstid=${listId}&format=json`;

        const response = await axios.get(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
                "Referer": "https://y.qq.com/",
                "Origin": "https://y.qq.com",
                "Host": "c.y.qq.com"
            },
            timeout: 10000
        });

        const data = response.data;

        if (!data.cdlist || data.cdlist.length === 0) {
            return res.status(404).json({ error: '未找到歌单数据（可能私密或不存在）' });
        }

        const playlist = data.cdlist[0];

        const songs = playlist.songlist.map(song => ({
            name: song.songname,
            singer: song.singer.map(s => s.name).join(', '),
            album: song.albumname,
            duration: song.interval,
            mid: song.songmid
        }));

        res.json({
            playlistId: listId,
            name: playlist.dissname,
            cover: playlist.logo,
            songCount: songs.length,
            songs
        });

    } catch (error) {
        console.error("接口异常：", error.message);

        res.status(500).json({
            error: '解析失败（可能被限制或接口变更）',
            detail: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 服务运行：http://localhost:${PORT}`);
});
