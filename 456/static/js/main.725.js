 $(function(){

      var api = ""
      var api = "api"
      var uploadApi = api+"/recognize/upload"
      var checkApi = api+"/recognize/test/submit"
      var selectApi = api+"/recognize/test/result?"
      var checkResult = '';
      var imgData = '';
      var selectedindex = -1;
      var picWidth;
      var picHeight;
      var realWidth;
      var realHeight;
      var keySubmit = '';
      var carLeftRate_x,carLeftRate_y;
      var carRightRate_x,carRightRate_y;
      var blob = '';
      var orientation;
      var compressMin = 200*1024;
      var compressMid1 = 280*1024;
      var compressMid2 = 350*1024;

      var photoMin = 3*1024*1024;

      //样式的修正
      var paddingLeft = $('.list-group').css('padding-right');
      $('.list-group').css('padding-left', paddingLeft);

      //兼容微信端的照相
      var u = navigator.userAgent;
      if(u.toLowerCase().match(/MicroMessenger/i)=='micromessenger'){
          // $('.upload-input-file').attr('capture','camera');
          $('.upload-input-file').attr('accept','image/*');
      }

      $('#preview').on('load',function(){
          //获取图片的宽度和高度
          picWidth = $('#preview').width();//图片的宽度
          picHeight = $('#preview').height();//图片的长度
      })

    //将base64转化成blob
    function dataURLtoBlob(dataurl) {
          var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
          while(n--){
              u8arr[n] = bstr.charCodeAt(n);
          }
          return new Blob([u8arr], {type:mime});
      }

      //设置canvas的定位
      var canvas = document.getElementById('paint');
      var cxt = canvas.getContext("2d");
      function canvasPos(canvas){
        
        // canvas布局在image_container的坐标，左上角相同
        var canvasoffset = $('.image_container').get(0).offsetLeft+parseInt($('.image_container').css('padding-left'));
        $('.scan').css('top',$('.image_container').get(0).offsetTop);
        $('.scan').css('left',$('.image_container').get(0).offsetLeft);
        $('.scan').css('width',$('.image_container').width()+2+parseInt($('.image_container').css('padding-left'))+parseInt($('.image_container').css('padding-right')))
        $('.scan').css('height',$('.image_container').height()+2+parseInt($('.image_container').css('padding-top'))+parseInt($('.image_container').css('padding-bottom')))

        var canvasTop = $('.image_container').get(0).offsetTop+parseInt($('.image_container').css('padding-top'));
        $('#paint').css('left',canvasoffset);
        $('#paint').css('top',canvasTop);
        canvas.width = $('.image_container').width()+2;
        canvas.height = $('.image_container').height()+2;
      }

      function clearCxt(cxt,canvas){
        cxt.clearRect(0,0,canvas.width,canvas.height);
      }
      canvasPos(canvas);


      //绘制车框
      function drawCar(carLeftRate_x,carLeftRate_y,carRightRate_x,carRightRate_y){
        //中心坐标
          var canvas_cx = $('.image_container').width()/2
          var canvas_cy = $('.image_container').height()/2
        
          //图片的左上角的横纵坐标(canvas_px,canvas_py)
          var canvas_px = canvas_cx - picWidth/2;
          var canvas_py = canvas_cy - picHeight/2;

          //车框坐标
          // carLeftRate_x = carLeftRate_y = 0.3
          // carRightRate_x = carRightRate_y = 0.6
          //to delete
          var car_x1 = canvas_px + picWidth * carLeftRate_x;
          var car_y1 = canvas_py + picHeight * carLeftRate_y
          // console.log(car_x1);
          // console.log(car_y1);

          var car_x2 = canvas_px + picWidth *carRightRate_x;
          var car_y2 = canvas_py + picHeight * carRightRate_y;
          var rectWidth = car_x2 - car_x1;
          var rectHeight = car_y2 - car_y1;

        
          cxt.beginPath(); 
          cxt.strokeStyle="#0033CC";/*设置边框*/ 
          cxt.lineWidth=1;/*边框的宽度*/ 
          cxt.strokeRect(car_x1,car_y1,rectWidth,rectHeight); 
          cxt.beginPath(); 
          cxt.closePath();/*可选步骤，关闭绘制的路径*/ 
          cxt.stroke(); 
      }
      

      function getOrientation(file, callback) {
        var reader = new FileReader();
        reader.onload = function(e) {

          var view = new DataView(e.target.result);
          if (view.getUint16(0, false) != 0xFFD8) return callback(-2);
          var length = view.byteLength, offset = 2;
          while (offset < length) {
            var marker = view.getUint16(offset, false);
            offset += 2;
            if (marker == 0xFFE1) {
                if (view.getUint32(offset += 2, false) != 0x45786966) return callback(-1);
                var little = view.getUint16(offset += 6, false) == 0x4949;
                offset += view.getUint32(offset + 4, little);
                var tags = view.getUint16(offset, little);
                offset += 2;
                for (var i = 0; i < tags; i++)
                  if (view.getUint16(offset + (i * 12), little) == 0x0112)
                    return callback(view.getUint16(offset + (i * 12) + 8, little));
            }
            else if ((marker & 0xFF00) != 0xFF00) break;
            else offset += view.getUint16(offset, false);
          }
          return callback(-1);
        };
        reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
      }

      /**
       *  修正 IOS 拍照上传图片裁剪时角度偏移（旋转）问题
       *
       *  img 图片的 base64
       *  dir exif 获取的方向信息
       *  next 回调方法，返回校正方向后的 base64
       * 
      **/
      function getImgData(img, dir, file,next) {
       
          var image = new Image();
       
          image.onload = function () {
       
              var degree = 0, drawWidth, drawHeight, width, height;
       
              drawWidth = this.naturalWidth;
              drawHeight = this.naturalHeight;
       
              // 改变一下图片大小
              var maxSide = Math.max(drawWidth, drawHeight);
              // if(file.size > compressMin){
              //     if (maxSide > 600) {
              //       var minSide = Math.min(drawWidth, drawHeight);
              //       minSide = minSide / maxSide * 600;
              //       maxSide = 600;
              //       if (drawWidth > drawHeight) {
              //           drawWidth = maxSide;
              //           drawHeight = minSide;
              //       } else {
              //           drawWidth = minSide;
              //           drawHeight = maxSide;
              //       }
              //   }
              // }
              //小于200k的不压缩
              if(file.size>compressMin)
              {
                var maxSide = Math.max(drawWidth, drawHeight);
                if(file.size > photoMin){
                  if (maxSide > 720) {
                      console.log("maxSide:1280,640");
                      var minSide = Math.min(drawWidth, drawHeight);
                      minSide = minSide / maxSide * 720;
                      maxSide = 720;
                     
                      if (drawWidth > drawHeight) {
                          drawWidth = maxSide;
                          drawHeight = minSide;
                      } else {
                          drawWidth = minSide;
                          drawHeight = maxSide;
                      }
                    }
                    else
                    {
                      var minSide = Math.min(drawWidth, drawHeight);
                      console.log("maxSide:600");
                      minSide = minSide / maxSide * 600;
                      maxSide = 600;
                      if (drawWidth > drawHeight) {
                          drawWidth = maxSide;
                          drawHeight = minSide;
                      } else {
                          drawWidth = minSide;
                          drawHeight = maxSide;
                      }
                    }

                }
                else if(file.size>compressMid1&&file.size<compressMid2){
                  // alert(5);
                  // alert(6)
                  var minSide = Math.min(drawWidth, drawHeight);
                      console.log("maxSide:720");
                      minSide = minSide / maxSide * 720;
                      maxSide = 720;
                      if (drawWidth > drawHeight) {
                          drawWidth = maxSide;
                          drawHeight = minSide;
                      } else {
                          drawWidth = minSide;
                          drawHeight = maxSide;
                      }

                }
                else{
                  console.log("1024*768");
                    var minSide =768;
                    maxSide = 1024;
                   
                    if (drawWidth > drawHeight) {
                        drawWidth = maxSide;
                        drawHeight = minSide;
                    } else {
                        drawWidth = minSide;
                        drawHeight = maxSide;
                    }
                }
              }

                
              // }
              // else if(file.size > compressMin){
              //     if (maxSide > 600) {
              //       var minSide = Math.min(drawWidth, drawHeight);
              //       minSide = minSide /3;
              //       maxSide = maxSide/3 ;
              //       // minSide = minSide / maxSide * 600;
              //       // maxSide = 600;
              //       if (drawWidth > drawHeight) {
              //           drawWidth = maxSide;
              //           drawHeight = minSide;
              //       } else {
              //           drawWidth = minSide;
              //           drawHeight = maxSide;
              //       }
              //   }
              // }
              

              // 创建画布
              var canvas = document.createElement("canvas");
              canvas.width = width = drawWidth;
              canvas.height = height = drawHeight;
              var context = canvas.getContext("2d");
       
              // 判断图片方向，重置 canvas 大小，确定旋转角度，iphone 默认的是 home 键在右方的横屏拍摄方式
              console.log("dir"+dir);
              // (3alert)
              switch (dir) {
                  // iphone 横屏拍摄，此时 home 键在左侧
                  case 3:
                      // alert(3);
                      degree = 180;
                      drawWidth = -width;
                      drawHeight = -height;
                      break;
                  // iphone 竖屏拍摄，此时 home 键在下方(正常拿手机的方向)
                  case 6:
                      // alert(6);
                      canvas.width = height;
                      canvas.height = width;
                      degree = 90;
                      drawWidth = width;
                      drawHeight = -height;
                      break;
                  // iphone 竖屏拍摄，此时 home 键在上方
                  case 8:
                      // alert(8);
                      canvas.width = height;
                      canvas.height = width;
                      degree = 270;
                      drawWidth = -width;
                      drawHeight = height;
                      break;
                  default:break;
              }
       
              // 使用 canvas 旋转校正
              context.rotate(degree * Math.PI / 180);
              context.drawImage(this, 0, 0, drawWidth, drawHeight);
       
              // 返回校正图片
              next(canvas.toDataURL("image/jpeg", .7));
          }
       
          image.src = img;
       
      }

      function downScaleImage(img, scale) {
          var imgCV = document.createElement('canvas');
          imgCV.width = img.width;
          imgCV.height = img.height;
          var imgCtx = imgCV.getContext('2d');
          imgCtx.drawImage(img, 0, 0);
          return downScaleCanvas(imgCV, scale);
      }

      function downScaleCanvas(cv, scale) {
          if (!(scale < 1) || !(scale > 0)) throw ('scale must be a positive number <1 ');
          var sqScale = scale * scale; // square scale = area of source pixel within target
          var sw = cv.width; // source image width
          var sh = cv.height; // source image height
          var tw = Math.floor(sw * scale); // target image width
          var th = Math.floor(sh * scale); // target image height
          var sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
          var tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
          var tX = 0, tY = 0; // rounded tx, ty
          var w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
          // weight is weight of current source point within target.
          // next weight is weight of current source point within next target's point.
          var crossX = false; // does scaled px cross its current px right border ?
          var crossY = false; // does scaled px cross its current px bottom border ?
          var sBuffer = cv.getContext('2d').
          getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
          var tBuffer = new Float32Array(3 * tw * th); // target buffer Float32 rgb
          var sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
          /* untested !
          var sA = 0;  //source alpha  */    

          for (sy = 0; sy < sh; sy++) {
              ty = sy * scale; // y src position within target
              tY = 0 | ty;     // rounded : target pixel's y
              yIndex = 3 * tY * tw;  // line index within target array
              crossY = (tY != (0 | ty + scale)); 
              if (crossY) { // if pixel is crossing botton target pixel
                  wy = (tY + 1 - ty); // weight of point within target pixel
                  nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
              }
              for (sx = 0; sx < sw; sx++, sIndex += 4) {
                  tx = sx * scale; // x src position within target
                  tX = 0 |  tx;    // rounded : target pixel's x
                  tIndex = yIndex + tX * 3; // target pixel index within target array
                  crossX = (tX != (0 | tx + scale));
                  if (crossX) { // if pixel is crossing target pixel's right
                      wx = (tX + 1 - tx); // weight of point within target pixel
                      nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
                  }
                  sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
                  sG = sBuffer[sIndex + 1];
                  sB = sBuffer[sIndex + 2];

                  /* !! untested : handling alpha !!
                     sA = sBuffer[sIndex + 3];
                     if (!sA) continue;
                     if (sA != 0xFF) {
                         sR = (sR * sA) >> 8;  // or use /256 instead ??
                         sG = (sG * sA) >> 8;
                         sB = (sB * sA) >> 8;
                     }
                  */
                  if (!crossX && !crossY) { // pixel does not cross
                      // just add components weighted by squared scale.
                      tBuffer[tIndex    ] += sR * sqScale;
                      tBuffer[tIndex + 1] += sG * sqScale;
                      tBuffer[tIndex + 2] += sB * sqScale;
                  } else if (crossX && !crossY) { // cross on X only
                      w = wx * scale;
                      // add weighted component for current px
                      tBuffer[tIndex    ] += sR * w;
                      tBuffer[tIndex + 1] += sG * w;
                      tBuffer[tIndex + 2] += sB * w;
                      // add weighted component for next (tX+1) px                
                      nw = nwx * scale
                      tBuffer[tIndex + 3] += sR * nw;
                      tBuffer[tIndex + 4] += sG * nw;
                      tBuffer[tIndex + 5] += sB * nw;
                  } else if (crossY && !crossX) { // cross on Y only
                      w = wy * scale;
                      // add weighted component for current px
                      tBuffer[tIndex    ] += sR * w;
                      tBuffer[tIndex + 1] += sG * w;
                      tBuffer[tIndex + 2] += sB * w;
                      // add weighted component for next (tY+1) px                
                      nw = nwy * scale
                      tBuffer[tIndex + 3 * tw    ] += sR * nw;
                      tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                      tBuffer[tIndex + 3 * tw + 2] += sB * nw;
                  } else { // crosses both x and y : four target points involved
                      // add weighted component for current px
                      w = wx * wy;
                      tBuffer[tIndex    ] += sR * w;
                      tBuffer[tIndex + 1] += sG * w;
                      tBuffer[tIndex + 2] += sB * w;
                      // for tX + 1; tY px
                      nw = nwx * wy;
                      tBuffer[tIndex + 3] += sR * nw;
                      tBuffer[tIndex + 4] += sG * nw;
                      tBuffer[tIndex + 5] += sB * nw;
                      // for tX ; tY + 1 px
                      nw = wx * nwy;
                      tBuffer[tIndex + 3 * tw    ] += sR * nw;
                      tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                      tBuffer[tIndex + 3 * tw + 2] += sB * nw;
                      // for tX + 1 ; tY +1 px
                      nw = nwx * nwy;
                      tBuffer[tIndex + 3 * tw + 3] += sR * nw;
                      tBuffer[tIndex + 3 * tw + 4] += sG * nw;
                      tBuffer[tIndex + 3 * tw + 5] += sB * nw;
              }
          } // end for sx 
        } // end for sy

        // create result canvas
        var resCV = document.createElement('canvas');
        resCV.width = tw;
        resCV.height = th;
        var resCtx = resCV.getContext('2d');
        var imgRes = resCtx.getImageData(0, 0, tw, th);
        var tByteBuffer = imgRes.data;
        // convert float32 array into a UInt8Clamped Array
        var pxIndex = 0; //  
        for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 3, tIndex += 4, pxIndex++) {
            tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
            tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
            tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
            tByteBuffer[tIndex + 3] = 255;
        }
        // writing result to canvas.
        resCtx.putImageData(imgRes, 0, 0);
        return resCV;
    }

      //对图片做压缩旋转和上传
      function readFile(file) {
          var formdata =new FormData();
          if (!/image\/\w+/.test(file.type)) {
              alert("image only please.");
              return false;
          }

          var reader = new FileReader();
          reader.readAsDataURL(file);
         
          reader.onload = function(e) {
              getImgData(e.target.result, orientation, file,function (data) {
                var f_size = file.size
                
                $("#preview").attr("src", data); 
                 if (navigator.userAgent.match(/iphone/i)) { 
                   f_size -= 10*1024;
                } 
                // alert(f_size);
                var minImageSize = 30*1024;
                
                // console.log("f_size"+ Number(f_size));

                // if(parseFloat(f_size)<parseFloat(minImageSize)){
                //   console.log(parseFloat(f_size),parseFloat(minImageSize))
                //   alert('low image resolution, the minimum size is 30k')
                //     $('.scan').css('display','none');
                //     $('.loading').css('display','none');
                //     return false;
                // }

                blob = dataURLtoBlob(data);
                console.log(blob.size);
                console.log(file.size);
                console.log(blob.size/file.size);
                formdata.append('file',blob,file['name'])
                formdata.append('token','bdctoken');
                uploadCar(formdata); //调用上传接口
              });
            }
      }

      function upLoadCar_r(data){
        console.log(data);
        const msg = data.msg;
        const code = data.code;
        const result = data.result;
        // const {msg,code,result} = data;//UC不行
        if(code === 0){
          var formdata = new FormData();
          formdata.append('img',result);
          formdata.append('appkey','test');
          return formdata;
        }
        else{
          alert(msg);
          return false;
        }
      }

      function checkCar(resp){
        console.log(resp);
        // const{code,msg,result:{model:{box,data},key}} = resp;
        // const{code,msg,result} = resp;
        const code = resp.code;
        const msg = resp.msg;
        const result = resp.result;
        console.log(code);
        if(code === 0){
          const model = result.model;
          const key = result.key;
          const box = model.box;
          const data = model.data;
          var str = "<tr><td class='text-center' colspan='3'>ID</td><td class='text-center' colspan='3'>品牌名</td><td class='text-center' colspan='3'>车型</td><td class='text-center' colspan='3'>概率</td></tr>";
          if(box.length === 0){
            str +="<tr><td class='text-center' colspan='12'>未能匹配到数据</td></tr>"
                    $('#resultTable').append(str);
                    $('.showResult').css('display','block');
                    $('.check').attr('disabled','disabled');
                    return false;
          }
          drawCar(box[0],box[1],box[2],box[3]);
          $('.check').attr('disabled',false);
          $.each(data,function(index,item){
            var carModelId = item.carModelId;
                    var brandName = item.brandName;
                    var carTypeName = item.carTypeName;
                    var prob = (Number(item.prob)*100).toFixed(2);
                    str+="<tr class='in-select'><td class='text-center' colspan='3'>"+carModelId+"</td><td class='text-center' colspan='3'>"+brandName+"</td><td class='text-center' colspan='3'>"+carTypeName+"</td><td class='text-center' colspan='3'>"+prob+"%</td></tr>"

          })

          str +="<tr class='in-select'><td class='text-center' colspan='12'>以上都不是</td></tr>"
                $('#resultTable').append(str);
                $('.showResult').css('display','block');
                keySubmit = key;

        }else{
          alert(msg);
          return false;
        }

      }

      function checkCarType(formdata){
        $.ajax({
                url: checkApi,
                type: "POST",  
                data: formdata,  
                cache: false, 
                contentType: false, 
                processData: false,
                beforeSend:function(){
                    $('.loading').css('display','block');           
              },
                success: function(data){
                  $('.scan').css('display','none');

                  $('.loading').css('display','none');
                  checkCar(data)
                },
                error: function (error) {  
                    $('.scan').css('display','none');
                    $('.loading').css('display','none');
                    alert("服务器返回错误");  
                                
                }    
            })//end check ajax

      }

      function uploadCar(formdata){
          $.ajax({
                url: uploadApi,
                type: "POST",  
                data: formdata,
                cache: false, 
                contentType: false, 
                processData: false,
                beforeSend:function(){
                    $('.loading').css('display','block');
                                
                },
                success:function(data){
                  $('.loading').css('display','none');
                  var formdata = new FormData();
                  formdata = upLoadCar_r(data);
                  checkCarType(formdata);
                  
                },
                error:function(data){
                    alert('图片上传失败')
                }
        })//end upload ajax
    }

    //input type = file中发生change事件时执行的函数
      $("#file_upload").change(function(ev) {
        //如果不是点击的取消
        if(($('#file_upload').get(0).files[0])){

            $('.scan').css('display','block');
            var input = ev.target;
            var file = input.files[0];
            // var windowURL = window.URL || window.webkitURL;
            // var dataURL = windowURL.createObjectURL(input.files[0]);
            // $("#preview").attr("src", dataURL); 
            
            $('.tips').css('display','none');
            $('.loading').css('display','block');

            //获取图片的方向
            getOrientation(input.files[0], function(data) {
              orientation = data;
              console.log("orientation"+orientation);
            });

            //对图片做压缩并上传和结果显示
            readFile(file);
            
            checkResult = ''
            imgData = ''
            clearCxt(cxt,canvas)
         
          
            $('.showResult').css('display','none');
            $('#resultTable').html("");

          }//end点击的不是取消
          else{
            //此处点击了取消，没有反应
          }
       
      });
      
      $('.table').on('click','tr.in-select',function(){
          checkResult = $(this).children('td').eq(0).html();
          if(checkResult==='以上都不是') 
          {
              checkResult= -1;
            // selectedindex = -1
          }

          console.log("index="+selectedindex+" id="+checkResult+" img="+imgData);

          $(this).addClass('active').siblings().removeClass('active');
      })

      $('.check').on('click',function(){
        // alert(checkResult);
          if(checkResult == ''){
            alert('请选择车型')
          }else{
            $.ajax({
                  url: selectApi+"key="+keySubmit+"&carModelId="+checkResult,
                  type: "GET",  
                  success: function(data){
                      alert('提交成功')
                      $(".showResult").fadeOut('slow');
                  },
                  error:function(data){
                      alert('提交失败')
                  }
              })
          } 
      });



  });