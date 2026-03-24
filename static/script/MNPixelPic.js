const { createApp } = Vue;

createApp({
    data() {
        return {
            mode: '3.0',
            imageBase64Data: "",
            srcImageWidth: 0,
            srcImageHeight: 0,
            destImgWidth: 100,
            destImgHeight: 100,
            lockWH: true,
            wh_ratio: 1,

            blockid: 605,
            removeWhite: false,

            isProcessing: false,
            luaScript: "",

            // 批量处理相关
            batchFiles: [],
            isBatchProcessing: false
        }
    },
    mounted() {
        // 添加上传区域点击事件监听
        const uploadArea = document.querySelector('.upload-area');
        const fileInput = this.$refs.fileInput;

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target !== fileInput) {
                    fileInput.click();
                }
            });
        }
    },
    methods: {
        dropfile(e) {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        },
        handleUploadFile(e) {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFiles(e.target.files);
            }
        },
        handleFiles(files) {
            // 清空之前的批量文件列表
            this.batchFiles = [];

            // 处理每个文件
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('image')) {
                    this.batchFiles.push({
                        file: file,
                        name: file.name,
                        status: 'pending' // pending, processing, completed
                    });
                }
            }

            // 如果只有一个文件，直接加载为预览
            if (files.length === 1 && files[0].type.startsWith('image')) {
                this.loadFile(files[0]);
            }
        },
        loadFile(file) {
            if (!file || !file.type.startsWith('image')) {
                alert('请上传有效的图片文件！');
                return;
            }

            // 检查文件大小（限制为5MB）
            if (file.size > 5 * 1024 * 1024) {
                alert('图片大小不能超过5MB！');
                return;
            }

            let reader = new FileReader();
            reader.onload = (e) => {
                this.imageBase64Data = e.target.result;
                let img = new Image();
                img.onload = () => {
                    this.srcImageWidth = img.width;
                    this.srcImageHeight = img.height;
                    this.wh_ratio = img.width / img.height;
                    // 默认缩放到宽度 100
                    this.destImgWidth = Math.min(img.width, 100);
                    this.destImgHeight = Math.floor(this.destImgWidth / this.wh_ratio);
                };
                img.onerror = () => {
                    alert('图片加载失败，请尝试其他图片！');
                };
                img.src = this.imageBase64Data;
            };
            reader.onerror = () => {
                alert('文件读取失败，请重试！');
            };
            reader.readAsDataURL(file);
        },
        inputWidth(e) {
            if (this.lockWH && e.target.value) {
                this.destImgHeight = Math.floor(e.target.value / this.wh_ratio);
            }
        },
        inputHeight(e) {
            if (this.lockWH && e.target.value) {
                this.destImgWidth = Math.floor(e.target.value * this.wh_ratio);
            }
        },

        // 从像素数据数组中提取坐标和颜色点
        getPointsFromData(data, width, height) {
            let points = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a < 50) continue;
                    if (this.removeWhite && r > 240 && g > 240 && b > 240) continue;

                    const hexVal = (1 << 24) + (r << 16) + (g << 8) + b;
                    const hexRaw = hexVal.toString(16).slice(1).toUpperCase();

                    let colorStr;
                    if (this.mode === '2.0') {
                        colorStr = `[=[0x${hexRaw}]=]`;
                    } else {
                        colorStr = `0x${hexRaw}`;
                    }

                    points.push({
                        x: x,
                        y: height - 1 - y,
                        c: colorStr
                    });
                }
            }
            return points;
        },

        generate() {
            if (!this.imageBase64Data) {
                alert('请先上传图片！');
                return;
            }

            if (this.destImgWidth <= 0 || this.destImgHeight <= 0) {
                alert('图片尺寸必须大于0！');
                return;
            }

            this.isProcessing = true;
            this.luaScript = "";

            // 使用 setTimeout 防止 UI 卡死
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = this.destImgWidth;
                canvas.height = this.destImgHeight;
                const ctx = canvas.getContext('2d');

                const img = new Image();
                img.src = this.imageBase64Data;
                img.onload = () => {
                    // 绘制图片到canvas
                    ctx.drawImage(img, 0, 0, this.destImgWidth, this.destImgHeight);
                    const imgData = ctx.getImageData(0, 0, this.destImgWidth, this.destImgHeight);
                    const points = this.getPointsFromData(imgData.data, this.destImgWidth, this.destImgHeight);

                    const script = this.buildLua(points);
                    this.luaScript = script;
                    this.isProcessing = false;
                };

                img.onerror = () => {
                    alert('图片处理失败，请重试！');
                    this.isProcessing = false;
                };
            }, 100);
        },

        // 生成 Lua 脚本并返回字符串（不直接操作 UI）
        buildLua(points) {
            let lines = [];

            if (this.mode === '2.0') {
                lines.push("-- [Script 2.0 / Global API] By.KsWeb");
                lines.push("local pixelData = {");
            } else {
                lines.push("local Script = {}");
                lines.push("-- [Script 3.0 / Class API] By.KsWeb");
                lines.push("local pixelData = {");
            }

            // 数据体
            let chunk = [];
            for (let i = 0; i < points.length; i++) {
                let p = points[i];
                chunk.push(`{${p.x},${p.y},${p.c}}`);
                if (chunk.length >= 20) {
                    lines.push("  " + chunk.join(",") + ",");
                    chunk = [];
                }
            }
            if (chunk.length > 0) lines.push("  " + chunk.join(",") + ",");

            lines.push("}");
            lines.push("");

            // 生成逻辑
            if (this.mode === '2.0') {
                // === 2.0 逻辑 ===
                lines.push("local function build(e)");
                lines.push("    local objId = e.eventobjid");
                lines.push("    local ret, x, y, z = Actor:getPosition(objId)");
                lines.push("    if ret ~= 0 then return end");
                lines.push("");
                lines.push("    local startX = math.floor(x) + 2");
                lines.push("    local startY = math.floor(y)");
                lines.push("    local startZ = math.floor(z)");
                lines.push("    local blockId = " + this.blockid);
                lines.push("");
                lines.push("    Chat:sendSystemMsg('脚本启动(2.0)，方块数: '..#pixelData)");
                lines.push("    local count = 0");
                lines.push("    local BATCH_SIZE = 300");
                lines.push("");
                lines.push("    for i, v in ipairs(pixelData) do");
                lines.push("        local tx = startX + v[1]");
                lines.push("        local ty = startY + v[2]");
                lines.push("        local tz = startZ");
                lines.push("");
                lines.push("        Trigger.Block:createBlock({x=tx, y=ty, z=tz}, blockId, 0, v[3])");
                lines.push("");
                lines.push("        count = count + 1");
                lines.push("        if count % BATCH_SIZE == 0 then");
                lines.push("            threadpool:wait(0.05)");
                lines.push("            Actor:setPosition(objId, tx, ty, tz + 2)");
                lines.push("        end");
                lines.push("    end");
                lines.push("    Chat:sendSystemMsg('生成结束')");
                lines.push("end");
                lines.push("");
                lines.push("ScriptSupportEvent:registerEvent([=[Player.UseItem]=], build)");
            } else {
                // === 3.0 逻辑 ===
                lines.push("function Script:OnStart()");
                lines.push("    self:AddTriggerEvent(TriggerEvent.PlayerUseItem, self.OnUse)");
                lines.push("end");
                lines.push("");
                lines.push("function Script:OnUse(e)");
                lines.push("    local objId = e.eventobjid");
                lines.push("    local x, y, z = Actor:GetPosition(objId)");
                lines.push("");
                lines.push("    local startX = math.floor(x) + 2");
                lines.push("    local startY = math.floor(y)");
                lines.push("    local startZ = math.floor(z)");
                lines.push("    local blockId = " + this.blockid);
                lines.push("");
                lines.push("    print('脚本启动(3.0)，方块数: '..#pixelData)");
                lines.push("    local count = 0");
                lines.push("    local BATCH_SIZE = 300");
                lines.push("");
                lines.push("    for i, v in ipairs(pixelData) do");
                lines.push("        local tx = startX + v[1]");
                lines.push("        local ty = startY + v[2]");
                lines.push("        local tz = startZ");
                lines.push("");
                lines.push("        Block:PlaceBlock(blockId, tx, ty, tz, 0, v[3])");
                lines.push("");
                lines.push("        count = count + 1");
                lines.push("        if count % BATCH_SIZE == 0 then");
                lines.push("            threadpool:wait(0.05)");
                lines.push("            Actor:SetPosition(objId, tx, ty, tz + 2)");
                lines.push("        end");
                lines.push("    end");
                lines.push("    print('生成结束')");
                lines.push("end");
                lines.push("return Script");
            }

            return lines.join("\n");
        },

        copy() {
            if (!this.luaScript) {
                alert('没有可复制的脚本！');
                return;
            }

            navigator.clipboard.writeText(this.luaScript).then(() => {
                alert("Lua脚本已复制到剪贴板！");
            }).catch(() => {
                // 如果clipboard API不可用，使用备用方法
                const textArea = document.createElement('textarea');
                textArea.value = this.luaScript;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert("Lua脚本已复制到剪贴板！");
            });
        },

        download() {
            if (!this.luaScript) {
                alert('没有可导出的脚本！');
                return;
            }

            // 创建Blob对象
            const blob = new Blob([this.luaScript], { type: 'text/plain;charset=utf-8' });

            // 创建下载链接
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'pixel_script.txt';
            link.click();

            // 清理URL对象
            URL.revokeObjectURL(link.href);
        },

        // 批量处理相关方法
        processBatch() {
            if (this.batchFiles.length === 0) {
                alert('请先添加要处理的图片文件！');
                return;
            }

            this.isBatchProcessing = true;

            // 递归处理文件
            this.processNextFile(0);
        },

        processNextFile(index) {
            if (index >= this.batchFiles.length) {
                this.isBatchProcessing = false;
                alert('所有文件处理完成！');
                return;
            }

            const fileItem = this.batchFiles[index];
            fileItem.status = 'processing';

            // 读取文件并处理
            this.processSingleFile(fileItem.file, (success, result) => {
                if (success) {
                    fileItem.status = 'completed';
                    // 保存结果到文件
                    this.saveBatchResult(fileItem.name, result);
                } else {
                    fileItem.status = 'error';
                }

                // 处理下一个文件
                setTimeout(() => {
                    this.processNextFile(index + 1);
                }, 100);
            });
        },

        processSingleFile(file, callback) {
            if (!file || !file.type.startsWith('image')) {
                callback(false);
                return;
            }

            // 检查文件大小（限制为5MB）
            if (file.size > 5 * 1024 * 1024) {
                callback(false);
                return;
            }

            let reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target.result;
                let img = new Image();
                img.onload = () => {
                    // 创建canvas处理图片
                    const canvas = document.createElement('canvas');
                    canvas.width = this.destImgWidth;
                    canvas.height = this.destImgHeight;
                    const ctx = canvas.getContext('2d');

                    // 绘制图片到canvas
                    ctx.drawImage(img, 0, 0, this.destImgWidth, this.destImgHeight);
                    const imgData = ctx.getImageData(0, 0, this.destImgWidth, this.destImgHeight);
                    const points = this.getPointsFromData(imgData.data, this.destImgWidth, this.destImgHeight);

                    // 生成Lua脚本
                    const luaScript = this.buildLua(points);
                    callback(true, luaScript);
                };
                img.onerror = () => {
                    callback(false);
                };
                img.src = imageData;
            };
            reader.onerror = () => {
                callback(false);
            };
            reader.readAsDataURL(file);
        },

        saveBatchResult(filename, luaScript) {
            // 创建Blob对象
            const blob = new Blob([luaScript], { type: 'text/plain;charset=utf-8' });

            // 创建下载链接
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename.replace(/\.[^/.]+$/, "") + '_pixel_script.txt';
            link.click();

            // 清理URL对象
            URL.revokeObjectURL(link.href);
        },

        getFileStatusText(status) {
            switch (status) {
                case 'pending': return '待处理';
                case 'processing': return '处理中';
                case 'completed': return '已完成';
                case 'error': return '错误';
                default: return '未知';
            }
        }
    }
}).mount('#pixelApp');
