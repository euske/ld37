# Makefile for assets

PYTHON=python
SOX=sox
LAME=lame -t --cbr

AUDIOS=jump.mp3 gun.mp3 speak.mp3 coin.mp3 siren.mp3 outage.mp3 poweron.mp3 hurt.mp3 music.mp3

all: $(AUDIOS)

clean:
	-$(RM) $(AUDIOS)

.SUFFIXES: .png .wav .mp3

.wav.mp3:
	$(SOX) $< -t wav - pad 0 0.5 | $(LAME) - $@
