(function() {
    "use strict";

    function makeSet() {
        var es = [];
        return {
            add: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) { return false; }
                }
                es.push(e);
                return true;
            },
            remove: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) {
                        es.splice(i, 1);
                        return true;
                    }
                }
                return false;
            },
            removeAll: function () {
                es = [];
            },
            contains: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) {
                        return true;
                    }
                }
                return false;
            },
            forEach: function (f) {
                var i, copy = [];
                for (i = 0; i < es.length; i += 1) {
                    copy.push(es[i]);
                }
                for (i = 0; i < copy.length; i += 1) {
                    f(copy[i]);
                }
            }
        };
    };

    function makeEvent() {
        var callbacks = makeSet();
        return {
            add: callbacks.add,
            remove: callbacks.remove,
            removeAll: callbacks.removeAll,
            fire: function (p1, p2, p3) {
                callbacks.forEach(function (callback) {
                    callback(p1, p2, p3);
                });
            }
        };
    };

    function element(tag, content) {
        var e = document.createElement(String(tag));
        if (content) {
            if (typeof content === "object") {
                e.appendChild(content);
            } else {
                e.textContent = String(content);
            }
        }
        return e;
    };


    function makeDraggable(subject) {
        var onstart = makeEvent(),
            onmove = makeEvent(),
            onend = makeEvent(),
            is_dragging = false,
            x = -1000,
            y = -1000;

        function checkmoved(e, fireevent) {
            e = e || window.event;
            if (!e) { return false; }
            try { e.preventDefault(); } catch (ignore) {}
            if (e.changedTouches &&
                    (e.changedTouches.length >= 1)) {
                e = e.changedTouches[0];
            }
            if (!e.pageX) { return; }
            if (!e.pageY) { return; }
            var dx = e.pageX - x,
                dy = e.pageY - y;
            if ((dx === 0) && (dy === 0)) { return; }
            x = e.pageX;
            y = e.pageY;
            if (fireevent) {
                onmove.fire({x: x, y: y, dx: dx, dy: dy});
            }
        }

        function move(e) {
            checkmoved(e, true);
            return false;
        }

        function end(e) {
            checkmoved(e, true);
            if (is_dragging) {
                is_dragging = false;
                document.removeEventListener('mousemove', move, false);
                document.removeEventListener('mouseup', end, false);
                document.removeEventListener('touchmove', move, false);
                document.removeEventListener('touchend', end, false);
                onend.fire();
            }
            return false;
        }

        function start(e) {
            if (e.target !== subject) {
                return;
            }
            try { e.preventDefault(); } catch (ignore) {}
            if (!is_dragging) {
                checkmoved(e, false);
                is_dragging = true;
                document.activeElement.blur();
                document.addEventListener('mousemove', move, false);
                document.addEventListener('mouseup', end, false);
                document.addEventListener('touchmove', move, false);
                document.addEventListener('touchend', end, false);
                onstart.fire({x: x, y: y});
            }
            return false;
        }

        subject.addEventListener('mousedown', start, false);
        subject.addEventListener('touchstart', start, false);

        return {
            onstart: onstart,
            onmove: onmove,
            onend: onend,
            clean: function () {
                end();
                onstart.removeAll();
                onmove.removeAll();
                onend.removeAll();
                subject.removeEventListener('mousedown', start, false);
                subject.removeEventListener('touchstart', start, false);
            }
        };
    }

    var sx = Math.round(window.innerWidth/2),
        sy = Math.round(window.innerHeight/2),
        updateAll = makeEvent();

    function createLine(obj1, obj2) {
        var line = element("div");
        document.body.appendChild(line);
        line.style.zIndex = -1000;
        line.style.height = "4px";
        line.style.position = "absolute";
        line.style.background = "#888";
        function drawline(ax, ay, bx, by) {
            var angle = -Math.atan2(ay-by, bx-ax) * 180 / Math.PI;
            var length = Math.sqrt((ax-bx)*(ax-bx)+(ay-by)*(ay-by));
            line.style.width = length + "px";
            line.style.left = (sx + ax) + "px";
            line.style.top = (sy + ay) + "px";
            line.style.transform = "rotate(" + angle + "deg)";
            line.style.transformOrigin = "0% 0%";
        }
        line.upd = function () {
            drawline(
                obj1.getx(),
                obj1.gety(),
                obj2.getx(),
                obj2.gety()
            );
        }
        return line;
    }

    function createNode(x, y, block_style) {
        var d = element("div");
        document.body.appendChild(d);
        d.className = "node";
        if (block_style) {
            d.className += " " + block_style;
        }
        var connectedLines = makeSet();

        var handle = {
            getx : function () {
                return x + Math.round(d.offsetWidth / 2);
            },
            gety : function () {
                return y + Math.round(d.offsetHeight / 2);;
            },
            addline : function (l) {
                connectedLines.add(l);
            }
        };

        function addbtn(dy) {
            var btn = element("div", "+");
            var style = block_style ? block_style :
                (dy > 0 ? "blockgreen" : "blockred");
            btn.className = "smallbtn " + style;
            btn.onclick = function () {
                var nn = createNode(
                    x + Math.round((d.offsetWidth - 78) / 2),
                    y + dy + ((dy > 0) ? d.offsetHeight - 65 : 0),
                    style);
                var nl = createLine(nn, handle);
                nn.addline(nl);
                handle.addline(nl);
                nl.upd();
            };
            d.appendChild(btn);
        }
        function addtext() {
            var t = element("div");
            t.className = "edittext";
            t.contentEditable = true;
            d.appendChild(t);
        }

        addbtn(-150);
        d.lastChild.style.top = "-40px";
        addtext();
        addbtn(150);
        d.lastChild.style.bottom = "-40px";

        var drag = makeDraggable(d);
        function upd() {
            d.style.left = (sx + x) + "px";
            d.style.top = (sy + y) + "px";
            connectedLines.forEach(function (l) {
                l.upd();
            });
        }
        drag.onmove.add(function (e) {
            x += e.dx;
            y += e.dy;
            upd();
        });
        upd();
        updateAll.add(upd);
        return handle;
    }

    function init() {
        makeDraggable(document.body).onmove.add(function (e) {
            sx += e.dx;
            sy += e.dy;
            updateAll.fire();
        });
        createNode(-50, -50);
    }

    setTimeout(init, 100);

}());
