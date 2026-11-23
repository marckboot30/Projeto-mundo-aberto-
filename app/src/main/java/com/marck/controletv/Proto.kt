package com.marck.controletv

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream

/** Protobuf mínimo, só o necessário para o protocolo do Android TV. */
class Pb {
    private val out = ByteArrayOutputStream()

    private fun varint(value: Long) {
        var v = value
        while (true) {
            if (v and 0x7FL.inv() == 0L) {
                out.write(v.toInt()); return
            }
            out.write(((v and 0x7F) or 0x80).toInt())
            v = v ushr 7
        }
    }

    fun int(field: Int, v: Long): Pb {
        varint((field shl 3).toLong()); varint(v); return this
    }

    fun int(field: Int, v: Int): Pb = int(field, v.toLong())

    fun bytes(field: Int, b: ByteArray): Pb {
        varint(((field shl 3) or 2).toLong()); varint(b.size.toLong()); out.write(b); return this
    }

    fun str(field: Int, s: String) = bytes(field, s.toByteArray())
    fun msg(field: Int, m: Pb) = bytes(field, m.toBytes())
    fun toBytes(): ByteArray = out.toByteArray()

    companion object {
        fun write(os: OutputStream, m: Pb) {
            val body = m.toBytes()
            val len = ByteArrayOutputStream()
            var n = body.size.toLong()
            while (true) {
                if (n and 0x7FL.inv() == 0L) { len.write(n.toInt()); break }
                len.write(((n and 0x7F) or 0x80).toInt()); n = n ushr 7
            }
            synchronized(os) {
                os.write(len.toByteArray() + body)
                os.flush()
            }
        }

        private fun readVarint(ins: InputStream): Long {
            var shift = 0
            var result = 0L
            while (true) {
                val b = ins.read()
                if (b < 0) throw EOFException()
                result = result or ((b and 0x7F).toLong() shl shift)
                if (b and 0x80 == 0) return result
                shift += 7
            }
        }

        fun read(ins: InputStream): Fields {
            val len = readVarint(ins).toInt()
            val buf = ByteArray(len)
            var off = 0
            while (off < len) {
                val r = ins.read(buf, off, len - off)
                if (r < 0) throw EOFException()
                off += r
            }
            return Fields.parse(buf)
        }
    }
}

class Fields(private val map: Map<Int, List<Any>>) {
    fun has(f: Int) = map.containsKey(f)
    fun long(f: Int): Long = (map[f]?.firstOrNull() as? Long) ?: 0L
    fun msg(f: Int): Fields? = (map[f]?.firstOrNull() as? ByteArray)?.let { parse(it) }

    companion object {
        fun parse(b: ByteArray): Fields {
            val m = HashMap<Int, MutableList<Any>>()
            var i = 0
            fun vi(): Long {
                var shift = 0; var r = 0L
                while (true) {
                    val x = b[i++].toInt() and 0xFF
                    r = r or ((x and 0x7F).toLong() shl shift)
                    if (x and 0x80 == 0) return r
                    shift += 7
                }
            }
            while (i < b.size) {
                val tag = vi()
                val field = (tag ushr 3).toInt()
                val v: Any = when ((tag and 7).toInt()) {
                    0 -> vi()
                    1 -> { i += 8; 0L }
                    2 -> { val n = vi().toInt(); val s = b.copyOfRange(i, i + n); i += n; s }
                    5 -> { i += 4; 0L }
                    else -> return Fields(m)
                }
                m.getOrPut(field) { mutableListOf() }.add(v)
            }
            return Fields(m)
        }
    }
}
